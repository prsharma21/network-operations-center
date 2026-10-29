import { ApiError, apiGet, apiPost, isMissingEndpoint } from '@/services/httpClient'
import { isRecord, readString, unwrapList } from '@/services/jsonParse'
import type {
  ApprovalAuditEntry,
  ApprovalDecisionRequest,
  ApprovalListResult,
  ApprovalRequest,
  ApprovalStatus,
} from '@/types/approval'
import { isApprovalDecision, isTerminalApproval } from '@/types/approval'
import type { EvidenceRef, IncidentInvestigation } from '@/types/incident'

export const APPROVALS_ENDPOINT = '/approvals'
export const incidentApproveEndpoint = (incidentId: string) => `/incidents/${incidentId}/approve`

const APPROVE_TIMEOUT_MS = 8000
const inFlight = new Set<string>()

function normalizeStatus(value: string | undefined): ApprovalStatus {
  if (value === 'approved' || value === 'approve') return 'approved'
  if (value === 'rejected' || value === 'reject') return 'rejected'
  if (value === 'deferred' || value === 'defer') return 'deferred'
  return 'pending'
}

function normalizeEvidence(value: unknown): EvidenceRef[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!isRecord(item)) return []
    const sourceEventId = readString(item, 'sourceEventId', 'source_event_id')
    if (!sourceEventId) return []
    return [{
      sourceEventId,
      source: readString(item, 'source') ?? 'evidence',
      timestamp: readString(item, 'timestamp') ?? '',
      summary: readString(item, 'summary') ?? sourceEventId,
    }]
  })
}

function normalizeAudit(value: unknown): ApprovalAuditEntry[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!isRecord(item)) return []
    const timestamp = readString(item, 'timestamp')
    if (!timestamp) return []
    const decisionRaw = readString(item, 'decision') ?? 'requested'
    const decision = isApprovalDecision(decisionRaw) || decisionRaw === 'requested' ? decisionRaw : 'requested'
    return [{
      timestamp,
      actor: readString(item, 'actor', 'approver') ?? 'Unknown',
      decision,
      comment: readString(item, 'comment', 'reason') ?? '',
      execution: 'not_executed',
    }]
  })
}

export function normalizeApproval(value: unknown): ApprovalRequest | null {
  if (!isRecord(value)) return null
  const incidentId = readString(value, 'incidentId', 'incident_id')
  if (!incidentId) return null
  const status = normalizeStatus(readString(value, 'status', 'approval_status', 'decision'))
  return {
    id: readString(value, 'id', 'approval_id', 'action_id') ?? `APR-${incidentId}`,
    incidentId,
    title: readString(value, 'title') ?? incidentId,
    proposedAction: readString(value, 'proposedAction', 'proposed_action', 'next_step', 'remediation', 'description') ?? 'No proposed next step was provided.',
    severity: (readString(value, 'severity') ?? 'info') as ApprovalRequest['severity'],
    priority: readString(value, 'priority') ?? 'P3',
    rationale: readString(value, 'rationale', 'reason', 'description') ?? 'No rationale was provided.',
    evidence: normalizeEvidence(value.evidence ?? value.supporting_evidence),
    risks: readString(value, 'risks', 'potential_risks') ?? null,
    expectedOutcome: readString(value, 'expectedOutcome', 'expected_outcome') ?? null,
    requestedAt: readString(value, 'requestedAt', 'requested_at', 'proposed_at', 'created_at') ?? new Date().toISOString(),
    status,
    approver: readString(value, 'approver', 'approved_by') ?? null,
    comment: readString(value, 'comment', 'reason') ?? null,
    decidedAt: readString(value, 'decidedAt', 'decided_at', 'approved_at') ?? null,
    audit: normalizeAudit(value.audit),
    source: 'api',
  }
}

export async function listApprovals(
  filters: { status?: ApprovalStatus } = {},
  signal?: AbortSignal,
): Promise<ApprovalListResult> {
  try {
    const query: Record<string, string> = {}
    if (filters.status) query.status = filters.status
    const payload = await apiGet<unknown>(APPROVALS_ENDPOINT, { signal, query })
    const rows = unwrapList(payload, 'approvals', 'items', 'requests')
    const items = rows.map(normalizeApproval).filter((item): item is ApprovalRequest => Boolean(item))
    if (items.length === 0 && rows.length > 0) {
      throw new ApiError('FastAPI approval list payload was not recognized', 502, APPROVALS_ENDPOINT)
    }
    return {
      items: filters.status ? items.filter((item) => item.status === filters.status) : items,
      source: 'api',
      asOf: items[0]?.requestedAt ?? new Date().toISOString(),
      missingEndpoints: [],
    }
  } catch (error) {
    if (isMissingEndpoint(error)) {
      return {
        items: [],
        source: 'api',
        asOf: new Date().toISOString(),
        missingEndpoints: [APPROVALS_ENDPOINT],
      }
    }
    throw error
  }
}

export interface SubmitApprovalResult {
  approval: ApprovalRequest
  investigation: IncidentInvestigation | null
}

export async function submitApproval(
  incidentId: string,
  request: ApprovalDecisionRequest,
  options: { current?: ApprovalRequest | null; signal?: AbortSignal } = {},
): Promise<SubmitApprovalResult> {
  const path = incidentApproveEndpoint(incidentId)
  if (!isApprovalDecision(request.decision)) {
    throw new ApiError('Unsupported approval decision.', 400, path)
  }
  if (inFlight.has(incidentId)) {
    throw new ApiError('An approval decision is already being recorded for this incident.', 409, path)
  }
  if (options.current && isTerminalApproval(options.current.status)) {
    throw new ApiError('This recommendation already has a recorded decision.', 409, path)
  }
  if ((request.decision === 'reject' || request.decision === 'defer') && !request.comment.trim()) {
    throw new ApiError('A comment is required to reject or defer a recommendation.', 400, path)
  }

  const body: ApprovalDecisionRequest = {
    decision: request.decision,
    comment: request.comment.trim(),
  }

  inFlight.add(incidentId)
  try {
    const payload = await apiPost<unknown>(path, body, { signal: options.signal, timeoutMs: APPROVE_TIMEOUT_MS })
    if (isRecord(payload) && Array.isArray(payload.correlatedAlarms ?? payload.correlated_alarms ?? [])) {
      const investigation = payload as unknown as IncidentInvestigation
      const approval = normalizeApproval(investigation.recommendation)
        ?? (options.current
          ? {
              ...options.current,
              status: body.decision === 'approve' ? 'approved' : body.decision === 'reject' ? 'rejected' : 'deferred',
              comment: body.comment || null,
              source: 'api' as const,
            }
          : null)
      if (!approval) {
        throw new ApiError('FastAPI approve payload was not recognized', 502, path)
      }
      return { approval, investigation: { ...investigation, recommendation: approval, source: 'api', missingEndpoints: [] } }
    }
    const approval = normalizeApproval(payload)
    if (!approval) {
      throw new ApiError('FastAPI approve payload was not recognized', 502, path)
    }
    return { approval, investigation: null }
  } finally {
    inFlight.delete(incidentId)
  }
}

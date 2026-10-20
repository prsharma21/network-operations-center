import type {
  ApprovalAuditEntry,
  ApprovalDecision,
  ApprovalRequest,
  ApprovalStatus,
} from '@/types/approval'
import { isTerminalApproval } from '@/types/approval'
import type { CandidateCause, CorrelatedAlarm, EvidenceRef } from '@/types/incident'
import type { RunbookPassage } from '@/types/runbook'
import type { Severity } from '@/types/ui'
import { DEMO_ENGINEER } from '@/utils/operator'
import { ApiError } from '@/services/httpClient'

const STORAGE_PREFIX = 'noc.approval.'
const records = new Map<string, ApprovalRequest>()
const inFlight = new Set<string>()

export interface RecommendationInput {
  incidentId: string
  title: string
  severity: Severity
  priority: string
  requestedAt: string
  candidates: CandidateCause[]
  runbookPassages: RunbookPassage[]
  alarms: CorrelatedAlarm[]
  includePending: boolean
}

function storageKey(incidentId: string): string {
  return `${STORAGE_PREFIX}${incidentId}`
}

function readStored(incidentId: string): ApprovalRequest | null {
  const memory = records.get(incidentId)
  if (memory) return memory
  try {
    const raw = window.sessionStorage.getItem(storageKey(incidentId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as ApprovalRequest
    records.set(incidentId, parsed)
    return parsed
  } catch {
    return null
  }
}

function writeStored(approval: ApprovalRequest): void {
  records.set(approval.incidentId, approval)
  try {
    window.sessionStorage.setItem(storageKey(approval.incidentId), JSON.stringify(approval))
  } catch {
    /* session storage is optional */
  }
}

function alarmEvidence(alarms: CorrelatedAlarm[]): EvidenceRef[] {
  return alarms.slice(0, 6).map((alarm) => ({
    sourceEventId: alarm.alarmId,
    source: 'alarm',
    timestamp: alarm.timestamp,
    summary: `${alarm.alarmType}: ${alarm.message}`,
  }))
}

function observationalStep(passages: RunbookPassage[]): string | null {
  for (const passage of passages) {
    const step = [...passage.steps].reverse().find((item) => item.trim())
    if (step) return step
  }
  return null
}

export function getStoredApproval(incidentId: string): ApprovalRequest | null {
  return readStored(incidentId)
}

export function buildRecommendation(input: RecommendationInput): ApprovalRequest | null {
  if (!input.includePending && input.candidates.length === 0) return null

  const stored = readStored(input.incidentId)
  const top = input.candidates[0]
  const passage = input.runbookPassages[0]
  const proposedAction = observationalStep(input.runbookPassages)
    ?? 'Review correlated evidence with a human operator. This console does not execute a network change.'
  const rationale = top
    ? `Ranked hypothesis “${top.title}” (${top.confidencePct}% estimated confidence, ${top.uncertainty} uncertainty) is not a verified root cause. ${top.hypothesis}`
    : passage
      ? `Recommendation is grounded in ${passage.sourceRef}. It is guidance for a human decision, not a confirmed RCA.`
      : 'Insufficient investigation evidence. Treat this as a pending human review request only.'
  const evidence = top?.supporting.length ? top.supporting : alarmEvidence(input.alarms)
  const requested: ApprovalAuditEntry = {
    timestamp: stored?.requestedAt ?? input.requestedAt,
    actor: 'Telecom NOC Copilot',
    decision: 'requested',
    comment: 'Proposed next step submitted for human approval. No network action was executed.',
    execution: 'not_executed',
  }

  const pending: ApprovalRequest = {
    id: stored?.id ?? `APR-${input.incidentId}`,
    incidentId: input.incidentId,
    title: input.title,
    proposedAction,
    severity: input.severity,
    priority: input.priority,
    rationale,
    evidence,
    risks: 'If the hypothesis is wrong, a later dispatch may be unnecessary. Approval does not restart, isolate, or reconfigure equipment.',
    expectedOutcome: 'A recorded human decision is stored for audit. Network state is unchanged by this approval.',
    requestedAt: stored?.requestedAt ?? input.requestedAt,
    status: 'pending',
    approver: null,
    comment: null,
    decidedAt: null,
    audit: stored?.status === 'pending' ? stored.audit : [requested],
    source: 'demo',
  }

  if (stored && isTerminalApproval(stored.status)) {
    return {
      ...stored,
      title: input.title,
      severity: input.severity,
      priority: input.priority,
      proposedAction: stored.proposedAction,
      rationale: stored.rationale,
      evidence: stored.evidence.length ? stored.evidence : evidence,
      source: 'demo',
    }
  }

  if (stored?.status === 'deferred') {
    return {
      ...stored,
      title: input.title,
      severity: input.severity,
      priority: input.priority,
      proposedAction,
      rationale,
      evidence,
      source: 'demo',
    }
  }

  return pending
}

export function recordDemoDecision(
  current: ApprovalRequest,
  decision: ApprovalDecision,
  comment: string,
): ApprovalRequest {
  const path = `/incidents/${current.incidentId}/approve`
  if (inFlight.has(current.incidentId)) {
    throw new ApiError('An approval decision is already being recorded for this incident.', 409, path)
  }
  if (isTerminalApproval(current.status)) {
    throw new ApiError('This recommendation already has a recorded decision.', 409, path)
  }

  const trimmed = comment.trim()
  if ((decision === 'reject' || decision === 'defer') && !trimmed) {
    throw new ApiError('A comment is required to reject or defer a recommendation.', 400, path)
  }

  inFlight.add(current.incidentId)
  try {
    const decidedAt = new Date().toISOString()
    const status: ApprovalStatus = decision === 'approve' ? 'approved' : decision === 'reject' ? 'rejected' : 'deferred'
    const entry: ApprovalAuditEntry = {
      timestamp: decidedAt,
      actor: DEMO_ENGINEER.name,
      decision,
      comment: trimmed || 'Approved without additional comment.',
      execution: 'not_executed',
    }
    const next: ApprovalRequest = {
      ...current,
      status,
      approver: DEMO_ENGINEER.name,
      comment: trimmed || null,
      decidedAt,
      audit: [...current.audit, entry],
      source: 'demo',
    }
    writeStored(next)
    return next
  } finally {
    inFlight.delete(current.incidentId)
  }
}

export function isApprovalInFlight(incidentId: string): boolean {
  return inFlight.has(incidentId)
}

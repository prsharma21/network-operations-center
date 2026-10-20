import type { EvidenceRef, TimelineEvent } from '@/types/incident'
import type { OperationalStatus, Severity } from '@/types/ui'

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'deferred'

export type ApprovalDecision = 'approve' | 'reject' | 'defer'

export interface ApprovalAuditEntry {
  timestamp: string
  actor: string
  decision: ApprovalDecision | 'requested'
  comment: string
  execution: 'not_executed'
}

export interface ApprovalRequest {
  id: string
  incidentId: string
  title: string
  proposedAction: string
  severity: Severity
  priority: string
  rationale: string
  evidence: EvidenceRef[]
  risks: string | null
  expectedOutcome: string | null
  requestedAt: string
  status: ApprovalStatus
  approver: string | null
  comment: string | null
  decidedAt: string | null
  audit: ApprovalAuditEntry[]
  source: 'api' | 'demo'
}

/**
 * FastAPI has not published an approve schema. The request body follows the
 * existing JSON POST convention (see POST /incidents/{incident_id}/investigate):
 * incident_id stays in the path; the body carries only the human decision.
 * This records a decision. It does not execute a network change.
 */
export interface ApprovalDecisionRequest {
  decision: ApprovalDecision
  comment: string
}

export interface ApprovalListResult {
  items: ApprovalRequest[]
  source: 'api' | 'demo'
  asOf: string
  missingEndpoints: string[]
}

export const APPROVAL_STATUS_FILTERS: Array<{ id: ApprovalStatus | 'all'; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'deferred', label: 'Deferred' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
]

export function isApprovalDecision(value: string): value is ApprovalDecision {
  return value === 'approve' || value === 'reject' || value === 'defer'
}

export function isTerminalApproval(status: ApprovalStatus): boolean {
  return status === 'approved' || status === 'rejected'
}

export function commentRequiredFor(decision: ApprovalDecision): boolean {
  return decision === 'reject' || decision === 'defer'
}

export function approvalStatusLabel(status: ApprovalStatus): string {
  if (status === 'approved') return 'Approved'
  if (status === 'rejected') return 'Rejected'
  if (status === 'deferred') return 'Deferred'
  return 'Pending'
}

export function approvalStatusTone(status: ApprovalStatus): OperationalStatus {
  if (status === 'approved') return 'approved'
  if (status === 'rejected') return 'rejected'
  if (status === 'deferred') return 'deferred'
  return 'pending'
}

export function decisionLabel(decision: ApprovalDecision): string {
  if (decision === 'approve') return 'Approve'
  if (decision === 'reject') return 'Reject'
  return 'Defer'
}

export function approvalTimelineEvent(approval: ApprovalRequest): TimelineEvent {
  const titles: Record<ApprovalStatus, string> = {
    pending: 'Recommendation pending human approval',
    approved: 'Recommendation approved',
    rejected: 'Recommendation rejected',
    deferred: 'Recommendation deferred',
  }
  const comment = approval.comment?.trim()
  const actor = approval.approver ? ` Approver: ${approval.approver}.` : ''
  const decisionNote = comment ? ` Comment: ${comment}.` : ''
  return {
    id: `${approval.incidentId}-approval`,
    kind: 'approval',
    timestamp: approval.decidedAt ?? approval.requestedAt,
    title: titles[approval.status],
    detail: `${approval.proposedAction}${actor}${decisionNote} This is a recorded human decision only. No network change was executed.`,
    sourceEventId: approval.id,
  }
}

export function upsertApprovalTimeline(events: TimelineEvent[], approval: ApprovalRequest): TimelineEvent[] {
  const next = events.filter((event) => event.kind !== 'approval')
  next.push(approvalTimelineEvent(approval))
  return next.sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime())
}

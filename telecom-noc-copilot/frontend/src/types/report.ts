import type { ApprovalAuditEntry, ApprovalRequest } from '@/types/approval'
import type {
  AffectedSite,
  CandidateCause,
  CorrelatedAlarm,
  IncidentInvestigation,
  InvestigationStatus,
  TimelineEvent,
} from '@/types/incident'
import { investigationStatusLabel } from '@/types/incident'
import type { RunbookPassage, RunbookRetrievalStatus } from '@/types/runbook'
import type { OperationalStatus, Severity } from '@/types/ui'

export type ReportProvenance = 'observed' | 'hypothesis' | 'recommendation' | 'human_decision'

export type ReportActionStatus = 'not_executed'

export interface ReportListItem {
  incidentId: string
  reportId: string
  title: string
  severity: Severity
  status: OperationalStatus
  createdAt: string
  generatedAt: string
}

export interface IncidentReport {
  reportId: string
  incidentId: string
  title: string
  summary: string
  severity: Severity
  priority: string
  status: OperationalStatus
  affectedSites: AffectedSite[]
  createdAt: string
  generatedAt: string
  investigationStatus: InvestigationStatus
  timeline: TimelineEvent[]
  correlatedAlarms: CorrelatedAlarm[]
  kpiAnomalies: TimelineEvent[]
  candidates: CandidateCause[]
  runbookPassages: RunbookPassage[]
  runbookRetrieval: RunbookRetrievalStatus
  recommendation: ApprovalRequest | null
  actionStatus: ReportActionStatus
  audit: ApprovalAuditEntry[]
  source: 'api' | 'demo'
  missingEndpoints: string[]
  asOf: string
}

export interface ReportCatalogResult {
  items: ReportListItem[]
  source: 'api' | 'demo'
  asOf: string
  missingEndpoints: string[]
}

export const PROVENANCE_LABEL: Record<ReportProvenance, string> = {
  observed: 'Observed fact',
  hypothesis: 'AI-generated hypothesis',
  recommendation: 'Recommendation',
  human_decision: 'Human decision',
}

export function reportSummary(incident: Pick<IncidentInvestigation, 'title' | 'status' | 'investigationStatus' | 'recommendation'>): string {
  const parts = [
    incident.title,
    `Current status: ${incident.status}.`,
    investigationStatusLabel(incident.investigationStatus) + '.',
  ]
  if (incident.investigationStatus === 'completed') {
    parts.push('Ranked candidate causes are AI hypotheses, not a verified root cause.')
  }
  if (incident.recommendation) {
    parts.push('Any recommended next step is for human review. Approval records a decision only and does not execute a network change.')
  }
  return parts.join(' ')
}

export function kpiAnomaliesFrom(timeline: TimelineEvent[]): TimelineEvent[] {
  return timeline.filter((event) => event.kind === 'kpi')
}

export function reportAuditFrom(incident: IncidentInvestigation): ApprovalAuditEntry[] {
  return incident.recommendation?.audit ?? []
}

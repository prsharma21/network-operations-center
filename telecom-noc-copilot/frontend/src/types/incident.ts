import type { ApprovalRequest } from '@/types/approval'
import type { RunbookPassage, RunbookRetrievalStatus } from '@/types/runbook'
import type { OperationalStatus, Severity } from '@/types/ui'

export type InvestigationStatus = 'not_started' | 'in_progress' | 'completed' | 'failed'

export type TimelineKind = 'alarm' | 'kpi' | 'deployment' | 'investigation' | 'approval'

export type EvidenceCategory = 'metric' | 'inventory' | 'topology' | 'deployment'

export interface AffectedSite {
  siteId: string
  siteName: string
}

export interface EvidenceRef {
  sourceEventId: string
  source: string
  timestamp: string
  summary: string
}

export interface CandidateCause {
  rank: number
  title: string
  hypothesis: string
  confidencePct: number
  uncertainty: 'high' | 'medium' | 'low'
  supporting: EvidenceRef[]
  contradictory: EvidenceRef[]
}

export interface TimelineEvent {
  id: string
  kind: TimelineKind
  timestamp: string
  title: string
  detail: string
  sourceEventId: string
}

export interface NetworkEvidenceItem {
  id: string
  category: EvidenceCategory
  title: string
  detail: string
  timestamp: string
  sourceEventId: string
}

export interface CorrelatedAlarm {
  alarmId: string
  severity: Severity
  timestamp: string
  siteId: string
  alarmType: string
  message: string
  status: OperationalStatus
}

export interface IncidentListItem {
  incidentId: string
  title: string
  siteId: string
  siteName: string
  severity: Severity
  priority: string
  status: OperationalStatus
  createdAt: string
  investigationStatus: InvestigationStatus
  reportId: string | null
}

export interface IncidentInvestigation {
  incidentId: string
  title: string
  severity: Severity
  priority: string
  status: OperationalStatus
  affectedSites: AffectedSite[]
  createdAt: string
  investigationStatus: InvestigationStatus
  correlatedAlarms: CorrelatedAlarm[]
  timeline: TimelineEvent[]
  evidence: NetworkEvidenceItem[]
  candidates: CandidateCause[]
  runbookPassages: RunbookPassage[]
  runbookRetrieval: RunbookRetrievalStatus
  recommendation: ApprovalRequest | null
  reportId: string | null
  reportHref: string | null
  investigationError: string | null
  source: 'api' | 'demo'
  missingEndpoints: string[]
  asOf: string
}

export function investigationStatusLabel(status: InvestigationStatus): string {
  if (status === 'not_started') return 'Not investigated'
  if (status === 'in_progress') return 'Investigation in progress'
  if (status === 'completed') return 'Hypotheses ready — not verified'
  return 'Investigation failed'
}

export function investigationStatusTone(status: InvestigationStatus): OperationalStatus {
  if (status === 'not_started') return 'pending'
  if (status === 'in_progress') return 'in-progress'
  if (status === 'completed') return 'open'
  return 'rejected'
}

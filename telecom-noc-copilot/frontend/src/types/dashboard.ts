import type { OperationalStatus, Severity } from '@/types/ui'

export const TIME_RANGES = ['1h', '24h', '7d'] as const

export type TimeRange = (typeof TIME_RANGES)[number]

export type DashboardDataSource = 'api' | 'demo'

export type NetworkEventKind = 'alarm' | 'deployment'

export type SeverityBucket = 'critical' | 'high' | 'medium' | 'low'

export interface DashboardKpis {
  activeAlarms: number
  criticalAlarms: number
  impactedSites: number
  openIncidents: number
  averageLatencyMs: number | null
}

export interface TrendPoint {
  timestamp: string
  latencyMs: number | null
  throughputMbps: number
  utilizationPct: number
  droppedCallRatePct: number
}

export interface SeverityDistributionItem {
  bucket: SeverityBucket
  label: string
  count: number
}

export interface RegionalHealthRow {
  region: string
  totalSites: number
  affectedSites: number
  activeAlarms: number
  status: Extract<OperationalStatus, 'healthy' | 'degraded' | 'critical'>
}

export interface RecentIncident {
  incidentId: string
  title: string
  siteId: string
  siteName: string
  severity: Severity
  status: OperationalStatus
  lastUpdated: string
}

export interface NetworkEvent {
  id: string
  kind: NetworkEventKind
  timestamp: string
  title: string
  siteId: string
  siteName: string
  severity?: Severity
  statusLabel: string
}

export interface DashboardSummary {
  range: TimeRange
  asOf: string
  source: DashboardDataSource
  missingEndpoint?: string
  kpis: DashboardKpis
  trends: TrendPoint[]
  severityDistribution: SeverityDistributionItem[]
  regionalHealth: RegionalHealthRow[]
  recentIncidents: RecentIncident[]
  recentEvents: NetworkEvent[]
}

export function isTimeRange(value: string | null | undefined): value is TimeRange {
  return value === '1h' || value === '24h' || value === '7d'
}

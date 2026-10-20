import type { RecentIncident, TimeRange, TrendPoint } from '@/types/dashboard'
import type { OperationalStatus, Severity } from '@/types/ui'
import type { KpiLevel } from '@/utils/kpiThresholds'

export interface SiteCatalogItem {
  siteId: string
  siteName: string
  region: string
  technology: string
  vendor: string
  status: OperationalStatus
  impacted: boolean
}

export interface SiteEquipment {
  equipmentId: string
  component: string
  vendor: string
  softwareVersion: string
  operationalState: OperationalStatus
}

export interface SiteKpiSnapshot {
  latencyMs: number | null
  throughputMbps: number | null
  utilizationPct: number | null
  droppedCallRatePct: number | null
  latencyLevel: KpiLevel
  throughputLevel: KpiLevel
  utilizationLevel: KpiLevel
  droppedCallLevel: KpiLevel
}

export interface SiteAlarmRow {
  alarmId: string
  timestamp: string
  code: string
  message: string
  severity: Severity
  status: OperationalStatus
}

export interface SiteDeploymentRow {
  deploymentId: string
  timestamp: string
  changeType: string
  versionBefore: string
  versionAfter: string
  statusLabel: string
  notes: string
}

export interface TopologyNode {
  id: string
  label: string
  kind: 'site' | 'aggregation' | 'core'
  status: OperationalStatus
}

export interface TopologyEdge {
  id: string
  from: string
  to: string
  linkType: string
  status: OperationalStatus
  capacityMbps: number
}

export interface SiteTopology {
  nodes: TopologyNode[]
  edges: TopologyEdge[]
}

export interface SiteHealth {
  siteId: string
  siteName: string
  region: string
  technology: string
  vendor: string
  siteType: string
  criticality: string
  backhaulType: string
  healthStatus: OperationalStatus
  activeAlarmCount: number
  range: TimeRange
  asOf: string
  source: 'api' | 'demo'
  missingEndpoints: string[]
  kpis: SiteKpiSnapshot
  trends: TrendPoint[]
  equipment: SiteEquipment[]
  activeAlarms: SiteAlarmRow[]
  deployments: SiteDeploymentRow[]
  incidents: RecentIncident[]
  topology: SiteTopology
}

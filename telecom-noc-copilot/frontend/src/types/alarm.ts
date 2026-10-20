import type { TimeRange } from '@/types/dashboard'
import type { OperationalStatus, Severity } from '@/types/ui'

export const ALARM_PAGE_SIZE = 25

export const ALARM_SORT_KEYS = [
  'alarmId',
  'alarmType',
  'severity',
  'siteId',
  'region',
  'networkComponent',
  'timestamp',
  'status',
  'relatedIncident',
] as const

export type AlarmSortKey = (typeof ALARM_SORT_KEYS)[number]
export type SortDirection = 'asc' | 'desc'

export interface RelatedIncidentRef {
  incidentId: string
  title: string
}

export interface AlarmSiteContext {
  siteId: string
  siteName: string
  region: string
  technology: string
  vendor: string
  siteType: string
  status: OperationalStatus
}

export interface AlarmListItem {
  alarmId: string
  alarmType: string
  message: string
  severity: Severity
  siteId: string
  siteName: string
  region: string
  technology: string
  networkComponent: string
  timestamp: string
  status: OperationalStatus
  relatedIncident: RelatedIncidentRef | null
  correlationKey: string | null
  source: string | null
  scenarioId: string | null
  payload: Record<string, unknown>
}

export interface AlarmQuery {
  severity?: string
  region?: string
  siteId?: string
  technology?: string
  status?: string
  range?: TimeRange
  q?: string
  sort: AlarmSortKey
  dir: SortDirection
  page: number
  pageSize: number
}

export interface AlarmFacets {
  severities: string[]
  regions: string[]
  technologies: string[]
  statuses: string[]
  sites: Array<{ siteId: string; siteName: string }>
}

export interface AlarmListResult {
  items: AlarmListItem[]
  total: number
  page: number
  pageSize: number
  asOf: string
  source: 'api' | 'demo'
  filtering: 'server' | 'client'
  missingEndpoints: string[]
  facets: AlarmFacets
}

export interface AlarmDetail {
  alarm: AlarmListItem
  site: AlarmSiteContext | null
  relatedAlarms: AlarmListItem[]
  source: 'api' | 'demo'
  missingEndpoints: string[]
}

export function isAlarmSortKey(value: string | null | undefined): value is AlarmSortKey {
  return ALARM_SORT_KEYS.includes(value as AlarmSortKey)
}

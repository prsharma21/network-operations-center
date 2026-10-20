import type { TimeRange } from '@/types/dashboard'
import type {
  AlarmDetail,
  AlarmFacets,
  AlarmListItem,
  AlarmListResult,
  AlarmQuery,
  AlarmSiteContext,
  RelatedIncidentRef,
} from '@/types/alarm'
import type {
  AlarmRecord,
  GroundTruthIncidentRecord,
  SiteRecord,
  TicketRecord,
} from '@/types/network'
import type { OperationalStatus, Severity } from '@/types/ui'

import alarmsFile from '../../../../data/alarms/alarms.json'
import incidentsFile from '../../../../data/ground_truth/expected_incidents.json'
import sitesFile from '../../../../data/sites/sites.json'
import ticketsFile from '../../../../data/tickets/tickets.json'

const RANGE_MS: Record<TimeRange, number> = {
  '1h': 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
}

const SEVERITY_RANK: Record<Severity, number> = {
  critical: 5,
  major: 4,
  warning: 3,
  minor: 2,
  info: 1,
  cleared: 0,
}

const COMPONENT_BY_CODE: Record<string, string> = {
  SITE_UNREACHABLE: 'Radio / cell',
  CELL_AVAILABILITY_LOSS: 'Radio / cell',
  ACCESSIBILITY_DEGRADATION: 'Radio / cell',
  HIGH_PRB_UTILIZATION: 'Radio capacity',
  HIGH_UTILIZATION: 'Radio capacity',
  HIGH_LATENCY: 'Radio capacity',
  THROUGHPUT_DEGRADATION: 'Radio capacity',
  DROPPED_CALLS_HIGH: 'Radio capacity',
  LOW_THROUGHPUT: 'Radio capacity',
  BACKHAUL_LINK_DOWN: 'Backhaul',
  PACKET_LOSS: 'Transport',
  POST_DEPLOYMENT_KPI_DEGRADATION: 'Configuration',
  CONFIGURATION_MISMATCH: 'Configuration',
  SYNC_FAILURE: 'Timing / sync',
  TEMPERATURE_WARNING: 'Environment',
  POWER_WARNING: 'Power',
}

const fixtures = {
  sites: sitesFile.sites as SiteRecord[],
  alarms: alarmsFile.alarms as AlarmRecord[],
  incidents: incidentsFile.incidents as GroundTruthIncidentRecord[],
  tickets: ticketsFile.tickets as TicketRecord[],
}

function parseTime(value: string): number {
  return new Date(value).getTime()
}

function datasetAsOf(): string {
  return new Date(Math.max(...fixtures.alarms.map((item) => parseTime(item.timestamp)))).toISOString()
}

function mapSeverity(value: string): Severity {
  if (value === 'critical' || value === 'major' || value === 'minor' || value === 'warning' || value === 'info' || value === 'cleared') {
    return value
  }
  return 'info'
}

function mapAlarmStatus(status: string): OperationalStatus {
  if (status === 'active' || status === 'acknowledged' || status === 'cleared') return status
  return 'open'
}

function mapSiteStatus(status: string): OperationalStatus {
  if (status === 'degraded') return 'degraded'
  if (status === 'down') return 'critical'
  if (status === 'up') return 'healthy'
  return 'inactive'
}

function networkComponent(code: string): string {
  return COMPONENT_BY_CODE[code] ?? 'Unspecified'
}

function incidentTitle(scenarioId: string, fallback: string): string {
  return fixtures.tickets.find((ticket) => ticket.scenario_id === scenarioId)?.title ?? fallback
}

function relatedIncidentMap(): Map<string, RelatedIncidentRef> {
  const map = new Map<string, RelatedIncidentRef>()
  for (const incident of fixtures.incidents) {
    const ref: RelatedIncidentRef = {
      incidentId: incident.incident_id,
      title: incidentTitle(incident.scenario_id, incident.expected_cause),
    }
    for (const alarmId of incident.evidence_alarm_ids) {
      map.set(alarmId, ref)
    }
    for (const alarm of fixtures.alarms) {
      if (alarm.scenario_id === incident.scenario_id && !map.has(alarm.alarm_id)) {
        map.set(alarm.alarm_id, ref)
      }
    }
  }
  return map
}

const RELATED_INCIDENTS = relatedIncidentMap()

function toListItem(record: AlarmRecord): AlarmListItem {
  const site = fixtures.sites.find((item) => item.site_id === record.site_id)
  return {
    alarmId: record.alarm_id,
    alarmType: record.alarm_code,
    message: record.message,
    severity: mapSeverity(record.severity),
    siteId: record.site_id,
    siteName: site?.site_name ?? record.site_id,
    region: record.region,
    technology: site?.technology ?? '—',
    networkComponent: networkComponent(record.alarm_code),
    timestamp: record.timestamp,
    status: mapAlarmStatus(record.status),
    relatedIncident: RELATED_INCIDENTS.get(record.alarm_id) ?? null,
    correlationKey: record.correlation_key ?? null,
    source: record.source ?? null,
    scenarioId: record.scenario_id,
    payload: { ...record },
  }
}

function siteContext(siteId: string): AlarmSiteContext | null {
  const site = fixtures.sites.find((item) => item.site_id === siteId)
  if (!site) return null
  return {
    siteId: site.site_id,
    siteName: site.site_name,
    region: site.region,
    technology: site.technology ?? '—',
    vendor: site.vendor ?? '—',
    siteType: site.site_type ?? '—',
    status: mapSiteStatus(site.status),
  }
}

export function demoAlarmFacets(): AlarmFacets {
  const rows = fixtures.alarms.map(toListItem)
  return {
    severities: [...new Set(rows.map((item) => item.severity))],
    regions: [...new Set(rows.map((item) => item.region))].sort(),
    technologies: [...new Set(rows.map((item) => item.technology).filter((item) => item !== '—'))].sort(),
    statuses: [...new Set(rows.map((item) => item.status))],
    sites: fixtures.sites
      .map((site) => ({ siteId: site.site_id, siteName: site.site_name }))
      .sort((left, right) => left.siteId.localeCompare(right.siteId)),
  }
}

export function filterDemoAlarms(rows: AlarmListItem[], query: AlarmQuery, asOf: string): AlarmListItem[] {
  const asOfMs = parseTime(asOf)
  const start = query.range ? asOfMs - RANGE_MS[query.range] : Number.NEGATIVE_INFINITY
  const needle = query.q?.trim().toLowerCase() ?? ''

  const filtered = rows.filter((item) => {
    if (query.severity && item.severity !== query.severity) return false
    if (query.region && item.region !== query.region) return false
    if (query.siteId && item.siteId !== query.siteId) return false
    if (query.technology && item.technology !== query.technology) return false
    if (query.status && item.status !== query.status) return false
    const time = parseTime(item.timestamp)
    if (time < start || time > asOfMs) return false
    if (!needle) return true
    const haystack = [
      item.alarmId,
      item.alarmType,
      item.message,
      item.siteId,
      item.siteName,
      item.region,
      item.networkComponent,
      item.relatedIncident?.incidentId ?? '',
      item.correlationKey ?? '',
    ].join(' ').toLowerCase()
    return haystack.includes(needle)
  })

  const direction = query.dir === 'asc' ? 1 : -1
  return filtered.sort((left, right) => {
    const key = query.sort
    if (key === 'timestamp') {
      return (parseTime(left.timestamp) - parseTime(right.timestamp)) * direction
    }
    if (key === 'severity') {
      return (SEVERITY_RANK[left.severity] - SEVERITY_RANK[right.severity]) * direction
    }
    const leftValue = key === 'relatedIncident'
      ? (left.relatedIncident?.incidentId ?? '')
      : String(left[key] ?? '')
    const rightValue = key === 'relatedIncident'
      ? (right.relatedIncident?.incidentId ?? '')
      : String(right[key] ?? '')
    return leftValue.localeCompare(rightValue) * direction
  })
}

export function queryDemoAlarms(query: AlarmQuery): AlarmListResult {
  const asOf = datasetAsOf()
  const filtered = filterDemoAlarms(fixtures.alarms.map(toListItem), query, asOf)
  const pageSize = query.pageSize
  const lastPage = Math.max(1, Math.ceil(filtered.length / pageSize) || 1)
  const page = Math.min(Math.max(1, query.page), lastPage)
  const start = (page - 1) * pageSize
  return {
    items: filtered.slice(start, start + pageSize),
    total: filtered.length,
    page,
    pageSize,
    asOf,
    source: 'demo',
    filtering: 'client',
    missingEndpoints: ['/alarms'],
    facets: demoAlarmFacets(),
  }
}

export function buildDemoAlarmDetail(alarmId: string): AlarmDetail {
  const rows = fixtures.alarms.map(toListItem)
  const alarm = rows.find((item) => item.alarmId === alarmId)
  if (!alarm) {
    throw new Error(`Unknown alarm ${alarmId}`)
  }
  const relatedAlarms = rows.filter((item) => (
    item.alarmId !== alarm.alarmId
    && (
      (alarm.correlationKey && item.correlationKey === alarm.correlationKey)
      || (alarm.scenarioId && item.scenarioId === alarm.scenarioId)
    )
  ))
  return {
    alarm,
    site: siteContext(alarm.siteId),
    relatedAlarms,
    source: 'demo',
    missingEndpoints: ['/alarms', `/alarms/${alarmId}`],
  }
}

export function demoAlarmExists(alarmId: string): boolean {
  return fixtures.alarms.some((item) => item.alarm_id === alarmId)
}

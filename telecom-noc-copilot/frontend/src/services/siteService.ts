import { ALARMS_ENDPOINT } from '@/services/alarmService'
import { ApiError, apiGet, isMissingEndpoint } from '@/services/httpClient'
import { isRecord, readNumber, readString, unwrapList } from '@/services/jsonParse'
import type { RecentIncident, TimeRange, TrendPoint } from '@/types/dashboard'
import type {
  SiteAlarmRow,
  SiteCatalogItem,
  SiteDeploymentRow,
  SiteEquipment,
  SiteHealth,
  SiteKpiSnapshot,
  SiteTopology,
  TopologyNode,
} from '@/types/site'
import type { OperationalStatus, Severity } from '@/types/ui'
import { classifyKpi, LATENCY_UNAVAILABLE_MS } from '@/utils/kpiThresholds'

/**
 * FastAPI contracts used by Site Health.
 *
 * GET /sites
 * GET /sites/{site_id}
 * GET /sites/{site_id}/metrics
 * GET /alarms?site_id={site_id}
 * GET /deployments?site_id={site_id}
 * GET /incidents?site_id={site_id}
 */
export const SITE_COLLECTION_ENDPOINT = '/sites'
export const siteDetailEndpoint = (siteId: string) => `/sites/${siteId}`
export const siteMetricsEndpoint = (siteId: string) => `/sites/${siteId}/metrics`
export const DEPLOYMENTS_ENDPOINT = '/deployments'
const INCIDENTS_ENDPOINT = '/incidents'

const RANGE_MS: Record<TimeRange, number> = {
  '1h': 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
}

function parseTime(value: string): number {
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : 0
}

function mapSiteStatus(status: string | undefined): OperationalStatus {
  if (status === 'degraded') return 'degraded'
  if (status === 'down' || status === 'critical') return 'critical'
  if (status === 'up' || status === 'healthy') return 'healthy'
  return 'inactive'
}

function mapAlarmStatus(status: string): OperationalStatus {
  if (status === 'active' || status === 'acknowledged' || status === 'cleared') return status
  if (status === 'open') return 'open'
  return 'open'
}

function mapAlarmSeverity(value: string): Severity {
  if (value === 'critical' || value === 'major' || value === 'minor' || value === 'warning' || value === 'info' || value === 'cleared') {
    return value
  }
  return 'info'
}

function mapEquipmentState(state: string): OperationalStatus {
  if (state === 'in_service' || state === 'healthy') return 'healthy'
  if (state === 'fault' || state === 'critical' || state === 'down') return 'critical'
  return 'maintenance'
}

function mapIncidentStatus(status: string): OperationalStatus {
  const normalized = status.toLowerCase().replaceAll('_', '-')
  if (normalized === 'open') return 'open'
  if (normalized === 'investigating' || normalized === 'in-progress') return 'in-progress'
  if (normalized === 'awaiting-approval' || normalized === 'pending') return 'pending'
  if (normalized === 'resolved' || normalized === 'closed' || normalized === 'cleared') return 'resolved'
  if (normalized === 'approved') return 'approved'
  return 'open'
}

function isOpenAlarm(status: string): boolean {
  return status === 'active' || status === 'acknowledged'
}

function latestTimestamp(values: Array<string | undefined>): string {
  const times = values.filter((value): value is string => Boolean(value))
  if (times.length === 0) return new Date().toISOString()
  return times.reduce((latest, value) => (parseTime(value) > parseTime(latest) ? value : latest))
}

function normalizeCatalogItem(value: unknown): SiteCatalogItem | null {
  if (!isRecord(value)) return null
  const siteId = readString(value, 'siteId', 'site_id')
  if (!siteId) return null
  const status = mapSiteStatus(readString(value, 'status'))
  return {
    siteId,
    siteName: readString(value, 'siteName', 'site_name') ?? siteId,
    region: readString(value, 'region') ?? '—',
    technology: readString(value, 'technology') ?? '—',
    vendor: readString(value, 'vendor') ?? '—',
    status,
    impacted: value.impacted === true || value.impacted === 'true' || status !== 'healthy',
  }
}

async function fetchOptionalList(
  path: string,
  query: Record<string, string>,
  signal: AbortSignal | undefined,
  missingEndpoints: string[],
): Promise<unknown[]> {
  try {
    const payload = await apiGet<unknown>(path, { signal, query })
    return unwrapList(payload, 'items', 'alarms', 'incidents', 'deployments', 'metrics')
  } catch (error) {
    if (isMissingEndpoint(error)) {
      missingEndpoints.push(Object.keys(query).length ? `${path}?${new URLSearchParams(query).toString()}` : path)
      return []
    }
    throw error
  }
}

function mapEquipment(value: unknown): SiteEquipment | null {
  if (!isRecord(value)) return null
  const equipmentId = readString(value, 'equipmentId', 'equipment_id')
  if (!equipmentId) return null
  return {
    equipmentId,
    component: (readString(value, 'component') ?? '—').replaceAll('_', ' '),
    vendor: readString(value, 'vendor') ?? '—',
    softwareVersion: readString(value, 'softwareVersion', 'software_version') ?? '—',
    operationalState: mapEquipmentState(readString(value, 'operationalState', 'operational_state') ?? ''),
  }
}

function mapAlarmRow(value: unknown): SiteAlarmRow | null {
  if (!isRecord(value)) return null
  const alarmId = readString(value, 'alarmId', 'alarm_id')
  if (!alarmId) return null
  return {
    alarmId,
    timestamp: readString(value, 'timestamp') ?? new Date().toISOString(),
    code: readString(value, 'code', 'alarm_code', 'alarm_type') ?? 'UNKNOWN',
    message: readString(value, 'message') ?? '',
    severity: mapAlarmSeverity(readString(value, 'severity') ?? 'info'),
    status: mapAlarmStatus(readString(value, 'status') ?? 'open'),
  }
}

function mapDeployment(value: unknown): SiteDeploymentRow | null {
  if (!isRecord(value)) return null
  const deploymentId = readString(value, 'deploymentId', 'deployment_id')
  if (!deploymentId) return null
  return {
    deploymentId,
    timestamp: readString(value, 'timestamp') ?? new Date().toISOString(),
    changeType: (readString(value, 'changeType', 'change_type') ?? 'change').replaceAll('_', ' '),
    versionBefore: readString(value, 'versionBefore', 'version_before') ?? '—',
    versionAfter: readString(value, 'versionAfter', 'version_after', 'version') ?? '—',
    statusLabel: (readString(value, 'statusLabel', 'status') ?? 'unknown').replaceAll('_', ' '),
    notes: readString(value, 'notes', 'change_summary') ?? '',
  }
}

function mapIncident(value: unknown, fallbackSiteName: string): RecentIncident | null {
  if (!isRecord(value)) return null
  const incidentId = readString(value, 'incidentId', 'incident_id')
  if (!incidentId) return null
  const siteId = readString(value, 'siteId', 'site_id') ?? 'unknown'
  return {
    incidentId,
    title: readString(value, 'title') ?? incidentId,
    siteId,
    siteName: readString(value, 'siteName', 'site_name') ?? fallbackSiteName,
    severity: mapAlarmSeverity(readString(value, 'severity') ?? 'info'),
    status: mapIncidentStatus(readString(value, 'status') ?? 'open'),
    lastUpdated: readString(value, 'lastUpdated', 'updated_at', 'created_at') ?? new Date().toISOString(),
  }
}

function mapTrend(value: unknown): TrendPoint | null {
  if (!isRecord(value)) return null
  const timestamp = readString(value, 'timestamp')
  const latencyMs = readNumber(value, 'latencyMs', 'latency_ms')
  const throughputMbps = readNumber(value, 'throughputMbps', 'throughput_mbps')
  const utilizationPct = readNumber(value, 'utilizationPct', 'utilization_pct')
  const droppedCallRatePct = readNumber(value, 'droppedCallRatePct', 'dropped_call_rate_pct', 'dropped_call_rate')
  if (!timestamp || throughputMbps === undefined || utilizationPct === undefined || droppedCallRatePct === undefined) {
    return null
  }
  return {
    timestamp,
    latencyMs: latencyMs !== undefined && latencyMs >= LATENCY_UNAVAILABLE_MS ? null : (latencyMs ?? null),
    throughputMbps,
    utilizationPct,
    droppedCallRatePct,
  }
}

function snapshotFromTrends(trends: TrendPoint[]): SiteKpiSnapshot {
  const latest = trends[trends.length - 1]
  const unreachable = latest?.latencyMs === null && latest !== undefined
  const latencyMs = latest && !unreachable ? latest.latencyMs : null
  const throughputMbps = latest?.throughputMbps ?? null
  const utilizationPct = latest && !unreachable ? latest.utilizationPct : null
  const droppedCallRatePct = latest?.droppedCallRatePct ?? null
  return {
    latencyMs,
    throughputMbps,
    utilizationPct,
    droppedCallRatePct,
    latencyLevel: classifyKpi('latencyMs', latencyMs),
    throughputLevel: classifyKpi('throughputMbps', throughputMbps),
    utilizationLevel: unreachable ? 'unavailable' : classifyKpi('utilizationPct', utilizationPct),
    droppedCallLevel: classifyKpi('droppedCallRatePct', droppedCallRatePct),
  }
}

function buildTopology(
  siteId: string,
  siteName: string,
  healthStatus: OperationalStatus,
  links: unknown[],
): SiteTopology {
  const edges = links
    .filter(isRecord)
    .map((link) => {
      const id = readString(link, 'id', 'link_id')
      const from = readString(link, 'from', 'source_id')
      const to = readString(link, 'to', 'target_id')
      if (!id || !from || !to) return null
      const status = readString(link, 'status') ?? 'up'
      return {
        id,
        from,
        to,
        linkType: (readString(link, 'linkType', 'link_type') ?? 'link').replaceAll('_', ' '),
        status: (status === 'down' || status === 'critical' ? 'critical' : 'healthy') as OperationalStatus,
        capacityMbps: readNumber(link, 'capacityMbps', 'capacity_mbps') ?? 0,
      }
    })
    .filter((edge): edge is SiteTopology['edges'][number] => Boolean(edge))

  const nodeIds = new Set<string>([siteId])
  for (const edge of edges) {
    nodeIds.add(edge.from)
    nodeIds.add(edge.to)
  }

  const nodes: TopologyNode[] = [...nodeIds].map((id) => {
    const kind = id.startsWith('SITE-') ? 'site' : id.startsWith('AGG-') ? 'aggregation' : 'core'
    const down = edges.some((edge) => (edge.from === id || edge.to === id) && edge.status === 'critical')
    return {
      id,
      label: id === siteId ? siteName : id,
      kind,
      status: id === siteId ? healthStatus : down ? 'critical' : 'healthy',
    }
  })

  return { nodes, edges }
}

function assembleSiteHealth(
  siteId: string,
  range: TimeRange,
  sitePayload: unknown,
  metricRows: unknown[],
  alarmRows: unknown[],
  deploymentRows: unknown[],
  incidentRows: unknown[],
  missingEndpoints: string[],
): SiteHealth {
  const site = isRecord(sitePayload) ? sitePayload : {}
  const siteName = readString(site, 'siteName', 'site_name') ?? siteId
  const alarms = alarmRows.map(mapAlarmRow).filter((row): row is SiteAlarmRow => Boolean(row))
  const activeAlarms = alarms
    .filter((alarm) => isOpenAlarm(alarm.status))
    .sort((left, right) => parseTime(right.timestamp) - parseTime(left.timestamp))

  let healthStatus = mapSiteStatus(readString(site, 'healthStatus', 'status'))
  if (activeAlarms.some((alarm) => alarm.severity === 'critical')) healthStatus = 'critical'
  else if (healthStatus === 'healthy' && activeAlarms.some((alarm) => alarm.severity === 'major')) healthStatus = 'degraded'

  const allTrends = metricRows
    .map(mapTrend)
    .filter((point): point is TrendPoint => Boolean(point))
    .sort((left, right) => parseTime(left.timestamp) - parseTime(right.timestamp))

  const asOf = latestTimestamp([
    readString(site, 'asOf', 'as_of', 'created_at'),
    allTrends.at(-1)?.timestamp,
    activeAlarms[0]?.timestamp,
    ...deploymentRows.map((row) => (isRecord(row) ? readString(row, 'timestamp') : undefined)),
    ...incidentRows.map((row) => (isRecord(row) ? readString(row, 'updated_at', 'created_at') : undefined)),
  ])
  const asOfMs = parseTime(asOf)
  const start = asOfMs - RANGE_MS[range]
  const trends = allTrends.filter((point) => parseTime(point.timestamp) >= start && parseTime(point.timestamp) <= asOfMs)

  return {
    siteId,
    siteName,
    region: readString(site, 'region') ?? '—',
    technology: readString(site, 'technology') ?? '—',
    vendor: readString(site, 'vendor') ?? '—',
    siteType: (readString(site, 'siteType', 'site_type') ?? '—').replaceAll('_', ' '),
    criticality: readString(site, 'criticality') ?? '—',
    backhaulType: readString(site, 'backhaulType', 'backhaul_type') ?? '—',
    healthStatus,
    activeAlarmCount: activeAlarms.length,
    range,
    asOf,
    source: 'api',
    missingEndpoints,
    kpis: snapshotFromTrends(trends),
    trends,
    equipment: unwrapList(site, 'equipment').map(mapEquipment).filter((row): row is SiteEquipment => Boolean(row)),
    activeAlarms,
    deployments: deploymentRows
      .map(mapDeployment)
      .filter((row): row is SiteDeploymentRow => Boolean(row))
      .sort((left, right) => parseTime(right.timestamp) - parseTime(left.timestamp)),
    incidents: incidentRows
      .map((row) => mapIncident(row, siteName))
      .filter((row): row is RecentIncident => Boolean(row))
      .sort((left, right) => parseTime(right.lastUpdated) - parseTime(left.lastUpdated)),
    topology: buildTopology(siteId, siteName, healthStatus, unwrapList(site, 'topology')),
  }
}

export async function getSiteCatalog(signal?: AbortSignal): Promise<SiteCatalogItem[]> {
  const payload = await apiGet<unknown>(SITE_COLLECTION_ENDPOINT, { signal })
  const rows = unwrapList(payload, 'sites', 'items')
  const items = rows.map(normalizeCatalogItem).filter((item): item is SiteCatalogItem => Boolean(item))
  if (items.length === 0 && rows.length > 0) {
    throw new ApiError('FastAPI site list payload was not recognized', 502, SITE_COLLECTION_ENDPOINT)
  }
  return items
}

export async function getSiteHealth(siteId: string, range: TimeRange, signal?: AbortSignal): Promise<SiteHealth> {
  const missingEndpoints: string[] = []
  const detailPath = siteDetailEndpoint(siteId)
  const metricsPath = siteMetricsEndpoint(siteId)
  const sitePayload = await apiGet<unknown>(detailPath, { signal })
  const [metricRows, alarmRows, deploymentRows, incidentRows] = await Promise.all([
    fetchOptionalList(metricsPath, { page_size: '100' }, signal, missingEndpoints),
    fetchOptionalList(ALARMS_ENDPOINT, { site_id: siteId, page_size: '100' }, signal, missingEndpoints),
    fetchOptionalList(DEPLOYMENTS_ENDPOINT, { site_id: siteId, page_size: '100' }, signal, missingEndpoints),
    fetchOptionalList(INCIDENTS_ENDPOINT, { site_id: siteId, page_size: '100' }, signal, missingEndpoints),
  ])
  return assembleSiteHealth(
    siteId,
    range,
    sitePayload,
    metricRows,
    alarmRows,
    deploymentRows,
    incidentRows,
    missingEndpoints,
  )
}

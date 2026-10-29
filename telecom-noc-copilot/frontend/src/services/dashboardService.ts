import { ALARMS_ENDPOINT } from '@/services/alarmService'
import { DEPLOYMENTS_ENDPOINT, SITE_COLLECTION_ENDPOINT } from '@/services/siteService'
import { INCIDENTS_ENDPOINT } from '@/services/incidentService'
import { ApiError, apiGet, isMissingEndpoint } from '@/services/httpClient'
import { isRecord, readNumber, readString, unwrapList } from '@/services/jsonParse'
import type {
  DashboardSummary,
  NetworkEvent,
  RecentIncident,
  RegionalHealthRow,
  SeverityBucket,
  TimeRange,
  TrendPoint,
} from '@/types/dashboard'
import type { OperationalStatus, Severity } from '@/types/ui'
import { average } from '@/utils/format'

export const DASHBOARD_SUMMARY_ENDPOINT = '/api/v1/dashboard/summary'
export const TELEMETRY_ENDPOINT = '/telemetry'

const RANGE_MS: Record<TimeRange, number> = {
  '1h': 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
}

function parseTime(value: string): number {
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : 0
}

function inWindow(iso: string, start: number, end: number): boolean {
  const time = parseTime(iso)
  return time >= start && time <= end
}

function mapSeverity(value: string | undefined): Severity {
  if (value === 'critical' || value === 'major' || value === 'minor' || value === 'warning' || value === 'info' || value === 'cleared') {
    return value
  }
  return 'info'
}

function mapIncidentStatus(status: string | undefined): OperationalStatus {
  const normalized = (status ?? 'open').toLowerCase().replaceAll('_', '-')
  if (normalized === 'open') return 'open'
  if (normalized === 'investigating' || normalized === 'in-progress') return 'in-progress'
  if (normalized === 'awaiting-approval' || normalized === 'pending') return 'pending'
  if (normalized === 'resolved' || normalized === 'closed' || normalized === 'cleared') return 'resolved'
  return 'open'
}

function isOpenAlarm(status: string): boolean {
  return status === 'active' || status === 'acknowledged' || status === 'open'
}

function severityBucket(severity: Severity): SeverityBucket {
  if (severity === 'critical') return 'critical'
  if (severity === 'major') return 'high'
  if (severity === 'minor') return 'medium'
  return 'low'
}

async function fetchRows(
  path: string,
  query: Record<string, string>,
  keys: string[],
  signal: AbortSignal | undefined,
): Promise<Record<string, unknown>[]> {
  try {
    const payload = await apiGet<unknown>(path, { signal, query, timeoutMs: 8000 })
    return unwrapList(payload, ...keys).filter(isRecord)
  } catch (error) {
    if (isMissingEndpoint(error)) return []
    throw error
  }
}

function composeDashboard(
  range: TimeRange,
  sites: Record<string, unknown>[],
  alarms: Record<string, unknown>[],
  incidents: Record<string, unknown>[],
  deployments: Record<string, unknown>[],
  metrics: Record<string, unknown>[],
): DashboardSummary {
  const siteName = (siteId: string) => {
    const site = sites.find((item) => readString(item, 'siteId', 'site_id') === siteId)
    return readString(site ?? {}, 'siteName', 'site_name') ?? siteId
  }

  const alarmTimes = alarms.map((item) => readString(item, 'timestamp')).filter(Boolean) as string[]
  const metricTimes = metrics.map((item) => readString(item, 'timestamp')).filter(Boolean) as string[]
  const deploymentTimes = deployments.map((item) => readString(item, 'timestamp')).filter(Boolean) as string[]
  const incidentTimes = incidents
    .flatMap((item) => [readString(item, 'updated_at', 'updatedAt'), readString(item, 'created_at', 'createdAt')])
    .filter(Boolean) as string[]
  const timestamps = [...alarmTimes, ...metricTimes, ...deploymentTimes, ...incidentTimes]
  const asOfMs = timestamps.length ? Math.max(...timestamps.map(parseTime)) : Date.now()
  const asOf = new Date(asOfMs).toISOString()
  const start = asOfMs - RANGE_MS[range]

  const alarmsInRange = alarms.filter((item) => {
    const timestamp = readString(item, 'timestamp')
    return timestamp ? inWindow(timestamp, start, asOfMs) : false
  })
  const openAlarms = alarmsInRange.filter((item) => isOpenAlarm(readString(item, 'status') ?? ''))
  const criticalAlarms = alarmsInRange.filter(
    (item) => mapSeverity(readString(item, 'severity')) === 'critical' && readString(item, 'status') !== 'cleared',
  )

  const telemetryInRange = metrics.filter((item) => {
    const timestamp = readString(item, 'timestamp')
    return timestamp ? inWindow(timestamp, start, asOfMs) : false
  })
  const deploymentsInRange = deployments.filter((item) => {
    const timestamp = readString(item, 'timestamp')
    return timestamp ? inWindow(timestamp, start, asOfMs) : false
  })

  const impactedSiteIds = new Set<string>()
  for (const site of sites) {
    const status = readString(site, 'status')
    const siteId = readString(site, 'siteId', 'site_id')
    if (siteId && status && status !== 'up' && status !== 'healthy') impactedSiteIds.add(siteId)
  }
  for (const alarm of openAlarms) {
    const severity = mapSeverity(readString(alarm, 'severity'))
    const siteId = readString(alarm, 'siteId', 'site_id')
    if (siteId && (severity === 'critical' || severity === 'major')) impactedSiteIds.add(siteId)
  }

  const latencySamples = telemetryInRange.flatMap((item) => {
    const latency = readNumber(item, 'latencyMs', 'latency_ms')
    const state = readString(item, 'state')
    if (latency === undefined || state === 'abnormal' || latency >= 900) return []
    return [latency]
  })

  const trendBuckets = new Map<string, { latency: number[]; throughput: number[]; utilization: number[]; drop: number[] }>()
  for (const sample of telemetryInRange) {
    const timestamp = readString(sample, 'timestamp')
    if (!timestamp) continue
    const bucket = trendBuckets.get(timestamp) ?? { latency: [], throughput: [], utilization: [], drop: [] }
    const latency = readNumber(sample, 'latencyMs', 'latency_ms')
    const throughput = readNumber(sample, 'throughputMbps', 'throughput_mbps')
    const utilization = readNumber(sample, 'utilizationPct', 'utilization_pct')
    const drop = readNumber(sample, 'droppedCallRatePct', 'dropped_call_rate_pct', 'dropped_call_rate')
    const state = readString(sample, 'state')
    if (latency !== undefined && state !== 'abnormal' && latency < 900) bucket.latency.push(latency)
    if (throughput !== undefined) bucket.throughput.push(throughput)
    if (utilization !== undefined) bucket.utilization.push(utilization)
    if (drop !== undefined) bucket.drop.push(drop)
    trendBuckets.set(timestamp, bucket)
  }

  const trends: TrendPoint[] = [...trendBuckets.entries()]
    .sort(([left], [right]) => parseTime(left) - parseTime(right))
    .map(([timestamp, bucket]) => ({
      timestamp,
      latencyMs: average(bucket.latency),
      throughputMbps: average(bucket.throughput) ?? 0,
      utilizationPct: average(bucket.utilization) ?? 0,
      droppedCallRatePct: average(bucket.drop) ?? 0,
    }))

  const distributionCounts: Record<SeverityBucket, number> = { critical: 0, high: 0, medium: 0, low: 0 }
  for (const alarm of alarmsInRange) {
    distributionCounts[severityBucket(mapSeverity(readString(alarm, 'severity')))] += 1
  }

  const regions = [...new Set(sites.map((site) => readString(site, 'region') ?? '—'))].sort()
  const regionalHealth: RegionalHealthRow[] = regions.map((region) => {
    const regionSites = sites.filter((site) => (readString(site, 'region') ?? '—') === region)
    const regionAlarms = openAlarms.filter((alarm) => (readString(alarm, 'region') ?? '—') === region)
    const affectedSites = new Set<string>()
    for (const site of regionSites) {
      const siteId = readString(site, 'siteId', 'site_id')
      const status = readString(site, 'status')
      if (siteId && status && status !== 'up' && status !== 'healthy') affectedSites.add(siteId)
    }
    for (const alarm of regionAlarms) {
      const severity = mapSeverity(readString(alarm, 'severity'))
      const siteId = readString(alarm, 'siteId', 'site_id')
      if (siteId && (severity === 'critical' || severity === 'major')) affectedSites.add(siteId)
    }
    const hasCritical = regionAlarms.some((alarm) => mapSeverity(readString(alarm, 'severity')) === 'critical')
    return {
      region,
      totalSites: regionSites.length,
      affectedSites: affectedSites.size,
      activeAlarms: regionAlarms.length,
      status: hasCritical ? 'critical' : affectedSites.size > 0 ? 'degraded' : 'healthy',
    }
  })

  const recentIncidents: RecentIncident[] = incidents
    .map((item) => {
      const siteId = readString(item, 'siteId', 'site_id') ?? 'unknown'
      const lastUpdated = readString(item, 'updated_at', 'updatedAt', 'created_at', 'createdAt') ?? asOf
      return {
        incidentId: readString(item, 'incidentId', 'incident_id') ?? '',
        title: readString(item, 'title') ?? 'Incident',
        siteId,
        siteName: readString(item, 'siteName', 'site_name') ?? siteName(siteId),
        severity: mapSeverity(readString(item, 'severity')),
        status: mapIncidentStatus(readString(item, 'status')),
        lastUpdated,
      }
    })
    .filter((item) => item.incidentId && inWindow(item.lastUpdated, start, asOfMs))
    .sort((left, right) => parseTime(right.lastUpdated) - parseTime(left.lastUpdated))
    .slice(0, 8)

  const openIncidents = incidents.filter((item) => {
    const status = mapIncidentStatus(readString(item, 'status'))
    return status === 'open' || status === 'in-progress' || status === 'acknowledged' || status === 'pending'
  }).length

  const alarmEvents: NetworkEvent[] = alarmsInRange.flatMap((alarm) => {
    const id = readString(alarm, 'alarmId', 'alarm_id')
    const timestamp = readString(alarm, 'timestamp')
    const siteId = readString(alarm, 'siteId', 'site_id') ?? 'unknown'
    if (!id || !timestamp) return []
    return [{
      id,
      kind: 'alarm' as const,
      timestamp,
      title: readString(alarm, 'message') ?? id,
      siteId,
      siteName: readString(alarm, 'siteName', 'site_name') ?? siteName(siteId),
      severity: mapSeverity(readString(alarm, 'severity')),
      statusLabel: (readString(alarm, 'status') ?? 'open').replaceAll('_', ' '),
    }]
  })

  const deploymentEvents: NetworkEvent[] = deploymentsInRange.flatMap((event) => {
    const id = readString(event, 'deploymentId', 'deployment_id')
    const timestamp = readString(event, 'timestamp')
    const siteId = readString(event, 'siteId', 'site_id') ?? 'unknown'
    if (!id || !timestamp) return []
    const changeType = readString(event, 'changeType', 'change_type') ?? 'change'
    const before = readString(event, 'versionBefore', 'version_before') ?? '—'
    const after = readString(event, 'versionAfter', 'version_after') ?? '—'
    return [{
      id,
      kind: 'deployment' as const,
      timestamp,
      title: `${changeType} ${before} → ${after}`,
      siteId,
      siteName: siteName(siteId),
      statusLabel: (readString(event, 'status') ?? 'unknown').replaceAll('_', ' '),
    }]
  })

  const recentEvents = [...alarmEvents, ...deploymentEvents]
    .sort((left, right) => parseTime(right.timestamp) - parseTime(left.timestamp))
    .slice(0, 12)

  return {
    range,
    asOf,
    source: 'api',
    kpis: {
      activeAlarms: openAlarms.length,
      criticalAlarms: criticalAlarms.length,
      impactedSites: impactedSiteIds.size,
      openIncidents,
      averageLatencyMs: average(latencySamples),
    },
    trends,
    severityDistribution: [
      { bucket: 'critical', label: 'Critical', count: distributionCounts.critical },
      { bucket: 'high', label: 'High', count: distributionCounts.high },
      { bucket: 'medium', label: 'Medium', count: distributionCounts.medium },
      { bucket: 'low', label: 'Low', count: distributionCounts.low },
    ],
    regionalHealth,
    recentIncidents,
    recentEvents,
  }
}

function isDashboardSummary(value: unknown): value is DashboardSummary {
  if (typeof value !== 'object' || value === null) return false
  const summary = value as Partial<DashboardSummary>
  return Boolean(summary.kpis && Array.isArray(summary.trends) && Array.isArray(summary.regionalHealth))
}

export async function getDashboardSummary(range: TimeRange, signal?: AbortSignal): Promise<DashboardSummary> {
  try {
    const payload = await apiGet<unknown>(DASHBOARD_SUMMARY_ENDPOINT, {
      query: { range },
      signal,
    })
    if (isDashboardSummary(payload)) {
      return { ...payload, range, source: 'api' }
    }
  } catch (error) {
    if (!(error instanceof ApiError && isMissingEndpoint(error))) throw error
  }

  const [sites, alarms, incidents, deployments, metrics] = await Promise.all([
    fetchRows(SITE_COLLECTION_ENDPOINT, { page_size: '200' }, ['items', 'sites'], signal),
    fetchRows(ALARMS_ENDPOINT, { page_size: '100' }, ['items', 'alarms'], signal),
    fetchRows(INCIDENTS_ENDPOINT, { page_size: '100' }, ['items', 'incidents'], signal),
    fetchRows(DEPLOYMENTS_ENDPOINT, { page_size: '100' }, ['items'], signal),
    fetchRows(TELEMETRY_ENDPOINT, { page_size: '500' }, ['items', 'metrics'], signal),
  ])

  return composeDashboard(range, sites, alarms, incidents, deployments, metrics)
}

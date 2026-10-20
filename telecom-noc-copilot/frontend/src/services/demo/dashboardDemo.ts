import type { DashboardSummary, RecentIncident, SeverityBucket, TimeRange } from '@/types/dashboard'
import type {
  AlarmRecord,
  DeploymentRecord,
  GroundTruthIncidentRecord,
  SiteRecord,
  TelemetryRecord,
  TicketRecord,
} from '@/types/network'
import type { OperationalStatus, Severity } from '@/types/ui'
import { average } from '@/utils/format'

import alarmsFile from '../../../../data/alarms/alarms.json'
import deploymentsFile from '../../../../data/deployments/deployment_events.json'
import incidentsFile from '../../../../data/ground_truth/expected_incidents.json'
import sitesFile from '../../../../data/sites/sites.json'
import telemetryFile from '../../../../data/telemetry/telemetry_metrics.json'
import ticketsFile from '../../../../data/tickets/tickets.json'

const RANGE_MS: Record<TimeRange, number> = {
  '1h': 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
}

const PRIORITY_SEVERITY: Record<string, Severity> = {
  P1: 'critical',
  P2: 'major',
  P3: 'minor',
  P4: 'warning',
}

const SEVERITY_RANK: Record<Severity, number> = {
  critical: 5,
  major: 4,
  warning: 3,
  minor: 2,
  info: 1,
  cleared: 0,
}

const fixtures = {
  sites: sitesFile.sites as SiteRecord[],
  alarms: alarmsFile.alarms as AlarmRecord[],
  metrics: telemetryFile.metrics as TelemetryRecord[],
  tickets: ticketsFile.tickets as TicketRecord[],
  deployment_events: deploymentsFile.deployment_events as DeploymentRecord[],
  incidents: incidentsFile.incidents as GroundTruthIncidentRecord[],
}

function parseTime(value: string): number {
  return new Date(value).getTime()
}

function inWindow(iso: string, start: number, end: number): boolean {
  const time = parseTime(iso)
  return time >= start && time <= end
}

function isOpenAlarm(status: string): boolean {
  return status === 'active' || status === 'acknowledged'
}

function isImpactAlarm(alarm: AlarmRecord): boolean {
  return isOpenAlarm(alarm.status) && (alarm.severity === 'critical' || alarm.severity === 'major')
}

function mapAlarmSeverity(value: string): Severity {
  if (value === 'critical' || value === 'major' || value === 'minor' || value === 'warning' || value === 'info' || value === 'cleared') {
    return value
  }
  return 'info'
}

function severityBucket(severity: Severity): SeverityBucket {
  if (severity === 'critical') return 'critical'
  if (severity === 'major') return 'high'
  if (severity === 'minor') return 'medium'
  return 'low'
}

function mapTicketStatus(status: string): OperationalStatus {
  if (status === 'in_progress') return 'in-progress'
  if (status === 'resolved') return 'resolved'
  if (status === 'open') return 'open'
  return 'pending'
}

function maxSeverity(values: Severity[]): Severity {
  return values.reduce<Severity>((highest, current) => (
    SEVERITY_RANK[current] > SEVERITY_RANK[highest] ? current : highest
  ), 'info')
}

export function buildDemoDashboard(range: TimeRange): DashboardSummary {
  const siteById = new Map(fixtures.sites.map((site) => [site.site_id, site]))
  const timestamps = [
    ...fixtures.alarms.map((item) => item.timestamp),
    ...fixtures.metrics.map((item) => item.timestamp),
    ...fixtures.tickets.map((item) => item.created_at),
    ...fixtures.deployment_events.map((item) => item.timestamp),
  ]
  const asOfMs = Math.max(...timestamps.map(parseTime))
  const asOf = new Date(asOfMs).toISOString()
  const start = asOfMs - RANGE_MS[range]

  const alarmsInRange = fixtures.alarms.filter((alarm) => inWindow(alarm.timestamp, start, asOfMs))
  const openAlarms = alarmsInRange.filter((alarm) => isOpenAlarm(alarm.status))
  const criticalAlarms = alarmsInRange.filter(
    (alarm) => alarm.severity === 'critical' && alarm.status !== 'cleared',
  )
  const telemetryInRange = fixtures.metrics.filter((sample) => inWindow(sample.timestamp, start, asOfMs))
  const deploymentsInRange = fixtures.deployment_events.filter((event) => inWindow(event.timestamp, start, asOfMs))

  const impactAlarms = alarmsInRange.filter(isImpactAlarm)
  const impactedSiteIds = new Set<string>()
  for (const site of fixtures.sites) {
    if (site.status !== 'up') impactedSiteIds.add(site.site_id)
  }
  for (const alarm of impactAlarms) {
    impactedSiteIds.add(alarm.site_id)
  }

  const latencySamples = telemetryInRange
    .filter((sample) => sample.state !== 'abnormal' && sample.latency_ms < 900)
    .map((sample) => sample.latency_ms)

  const trendBuckets = new Map<string, { latency: number[]; throughput: number[]; utilization: number[]; drop: number[] }>()
  for (const sample of telemetryInRange) {
    const bucket = trendBuckets.get(sample.timestamp) ?? {
      latency: [],
      throughput: [],
      utilization: [],
      drop: [],
    }
    if (sample.state !== 'abnormal' && sample.latency_ms < 900) {
      bucket.latency.push(sample.latency_ms)
    }
    bucket.throughput.push(sample.throughput_mbps)
    bucket.utilization.push(sample.utilization_pct)
    bucket.drop.push(sample.dropped_call_rate_pct)
    trendBuckets.set(sample.timestamp, bucket)
  }

  const trends = [...trendBuckets.entries()]
    .sort(([left], [right]) => parseTime(left) - parseTime(right))
    .map(([timestamp, bucket]) => ({
      timestamp,
      latencyMs: average(bucket.latency),
      throughputMbps: average(bucket.throughput) ?? 0,
      utilizationPct: average(bucket.utilization) ?? 0,
      droppedCallRatePct: average(bucket.drop) ?? 0,
    }))

  const distributionCounts: Record<SeverityBucket, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  }
  for (const alarm of alarmsInRange) {
    distributionCounts[severityBucket(mapAlarmSeverity(alarm.severity))] += 1
  }

  const regions = [...new Set(fixtures.sites.map((site) => site.region))].sort()
  const regionalHealth = regions.map((region) => {
    const regionSites = fixtures.sites.filter((site) => site.region === region)
    const regionAlarms = openAlarms.filter((alarm) => alarm.region === region)
    const regionImpactAlarms = impactAlarms.filter((alarm) => alarm.region === region)
    const affectedSites = new Set<string>()
    for (const site of regionSites) {
      if (site.status !== 'up') affectedSites.add(site.site_id)
    }
    for (const alarm of regionImpactAlarms) {
      affectedSites.add(alarm.site_id)
    }
    const hasCritical = regionAlarms.some((alarm) => alarm.severity === 'critical')
    const status = hasCritical ? 'critical' : affectedSites.size > 0 ? 'degraded' : 'healthy'
    return {
      region,
      totalSites: regionSites.length,
      affectedSites: affectedSites.size,
      activeAlarms: regionAlarms.length,
      status,
    } as const
  })

  const alarmById = new Map(fixtures.alarms.map((alarm) => [alarm.alarm_id, alarm]))
  const scenarioIncidents: RecentIncident[] = fixtures.incidents.map((incident) => {
    const site = siteById.get(incident.site_id)
    const evidence = incident.evidence_alarm_ids
      .map((id) => alarmById.get(id))
      .filter((alarm): alarm is AlarmRecord => Boolean(alarm))
    const lastUpdated = evidence.reduce(
      (latest, alarm) => (parseTime(alarm.timestamp) > parseTime(latest) ? alarm.timestamp : latest),
      evidence[0]?.timestamp ?? asOf,
    )
    const openEvidence = evidence.filter((alarm) => isOpenAlarm(alarm.status))
    const status: OperationalStatus = openEvidence.length > 0
      ? (openEvidence.some((alarm) => alarm.status === 'active') ? 'open' : 'acknowledged')
      : 'resolved'
    return {
      incidentId: incident.incident_id,
      title: incident.expected_cause,
      siteId: incident.site_id,
      siteName: site?.site_name ?? incident.site_id,
      severity: maxSeverity(evidence.map((alarm) => mapAlarmSeverity(alarm.severity))),
      status,
      lastUpdated,
    }
  })

  const coveredScenarios = new Set(fixtures.incidents.map((incident) => incident.scenario_id))
  const ticketIncidents: RecentIncident[] = fixtures.tickets
    .filter((ticket) => !ticket.scenario_id || !coveredScenarios.has(ticket.scenario_id))
    .map((ticket) => {
      const site = siteById.get(ticket.site_id)
      return {
        incidentId: ticket.ticket_id,
        title: ticket.title,
        siteId: ticket.site_id,
        siteName: site?.site_name ?? ticket.site_id,
        severity: PRIORITY_SEVERITY[ticket.priority] ?? 'info',
        status: mapTicketStatus(ticket.status),
        lastUpdated: ticket.created_at,
      }
    })

  const recentIncidents = [
    ...scenarioIncidents
      .filter((incident) => inWindow(incident.lastUpdated, start, asOfMs))
      .sort((left, right) => parseTime(right.lastUpdated) - parseTime(left.lastUpdated)),
    ...ticketIncidents
      .filter((incident) => inWindow(incident.lastUpdated, start, asOfMs))
      .sort((left, right) => parseTime(right.lastUpdated) - parseTime(left.lastUpdated)),
  ].slice(0, 8)

  const openIncidents = [...scenarioIncidents, ...ticketIncidents].filter(
    (incident) => incident.status === 'open' || incident.status === 'in-progress' || incident.status === 'acknowledged',
  ).length

  const alarmEvents = alarmsInRange.map((alarm) => ({
    id: alarm.alarm_id,
    kind: 'alarm' as const,
    timestamp: alarm.timestamp,
    title: alarm.message,
    siteId: alarm.site_id,
    siteName: siteById.get(alarm.site_id)?.site_name ?? alarm.site_id,
    severity: mapAlarmSeverity(alarm.severity),
    statusLabel: alarm.status.replace('_', ' '),
  }))

  const deploymentEvents = deploymentsInRange.map((event) => ({
    id: event.deployment_id,
    kind: 'deployment' as const,
    timestamp: event.timestamp,
    title: `${event.change_type} ${event.version_before} → ${event.version_after}`,
    siteId: event.site_id,
    siteName: siteById.get(event.site_id)?.site_name ?? event.site_id,
    statusLabel: event.status.replaceAll('_', ' '),
  }))

  const recentEvents = [...alarmEvents, ...deploymentEvents]
    .sort((left, right) => parseTime(right.timestamp) - parseTime(left.timestamp))
    .slice(0, 12)

  return {
    range,
    asOf,
    source: 'demo',
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

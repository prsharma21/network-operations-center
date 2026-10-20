import type { RecentIncident, TimeRange, TrendPoint } from '@/types/dashboard'
import type {
  AlarmRecord,
  DeploymentRecord,
  EquipmentRecord,
  GroundTruthIncidentRecord,
  SiteRecord,
  TelemetryRecord,
  TicketRecord,
  TopologyLinkRecord,
} from '@/types/network'
import type {
  SiteCatalogItem,
  SiteDeploymentRow,
  SiteEquipment,
  SiteHealth,
  SiteTopology,
  TopologyNode,
} from '@/types/site'
import type { OperationalStatus, Severity } from '@/types/ui'
import { classifyKpi, LATENCY_UNAVAILABLE_MS } from '@/utils/kpiThresholds'

import alarmsFile from '../../../../data/alarms/alarms.json'
import deploymentsFile from '../../../../data/deployments/deployment_events.json'
import incidentsFile from '../../../../data/ground_truth/expected_incidents.json'
import ossFile from '../../../../data/oss/oss_inventory.json'
import sitesFile from '../../../../data/sites/sites.json'
import telemetryFile from '../../../../data/telemetry/telemetry_metrics.json'
import ticketsFile from '../../../../data/tickets/tickets.json'
import topologyFile from '../../../../data/topology/network_topology.json'

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

const fixtures = {
  sites: sitesFile.sites as SiteRecord[],
  alarms: alarmsFile.alarms as AlarmRecord[],
  metrics: telemetryFile.metrics as TelemetryRecord[],
  tickets: ticketsFile.tickets as TicketRecord[],
  deployments: deploymentsFile.deployment_events as DeploymentRecord[],
  incidents: incidentsFile.incidents as GroundTruthIncidentRecord[],
  equipment: ossFile.equipment as EquipmentRecord[],
  links: topologyFile.links as TopologyLinkRecord[],
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

function mapSiteStatus(status: string): OperationalStatus {
  if (status === 'degraded') return 'degraded'
  if (status === 'down') return 'critical'
  if (status === 'up') return 'healthy'
  return 'inactive'
}

function mapAlarmStatus(status: string): OperationalStatus {
  if (status === 'active' || status === 'acknowledged' || status === 'cleared') return status
  return 'open'
}

function mapAlarmSeverity(value: string): Severity {
  if (value === 'critical' || value === 'major' || value === 'minor' || value === 'warning' || value === 'info' || value === 'cleared') {
    return value
  }
  return 'info'
}

function mapTicketStatus(status: string): OperationalStatus {
  if (status === 'in_progress') return 'in-progress'
  if (status === 'resolved') return 'resolved'
  if (status === 'open') return 'open'
  return 'pending'
}

function mapEquipmentState(state: string): OperationalStatus {
  if (state === 'in_service') return 'healthy'
  if (state === 'fault') return 'critical'
  return 'maintenance'
}

function datasetAsOf(): string {
  const timestamps = [
    ...fixtures.alarms.map((item) => item.timestamp),
    ...fixtures.metrics.map((item) => item.timestamp),
    ...fixtures.deployments.map((item) => item.timestamp),
    ...fixtures.tickets.map((item) => item.created_at),
  ]
  return new Date(Math.max(...timestamps.map(parseTime))).toISOString()
}

function windowFor(range: TimeRange): { start: number; asOf: string; asOfMs: number } {
  const asOf = datasetAsOf()
  const asOfMs = parseTime(asOf)
  return { asOf, asOfMs, start: asOfMs - RANGE_MS[range] }
}

function catalogStatus(site: SiteRecord): OperationalStatus {
  const openAlarms = fixtures.alarms.filter((alarm) => alarm.site_id === site.site_id && isOpenAlarm(alarm.status))
  if (site.status === 'down' || openAlarms.some((alarm) => alarm.severity === 'critical')) return 'critical'
  if (site.status === 'degraded' || openAlarms.some((alarm) => alarm.severity === 'major')) return 'degraded'
  return mapSiteStatus(site.status)
}

function isImpacted(site: SiteRecord): boolean {
  return catalogStatus(site) !== 'healthy'
}

export function listDemoSites(): SiteCatalogItem[] {
  return fixtures.sites.map((site) => ({
    siteId: site.site_id,
    siteName: site.site_name,
    region: site.region,
    technology: site.technology ?? '—',
    vendor: site.vendor ?? '—',
    status: catalogStatus(site),
    impacted: isImpacted(site),
  }))
}

function siteIncidents(site: SiteRecord): RecentIncident[] {
  const covered = new Set(fixtures.incidents.filter((incident) => incident.site_id === site.site_id).map((incident) => incident.scenario_id))
  const known: RecentIncident[] = fixtures.incidents
    .filter((incident) => incident.site_id === site.site_id)
    .map((incident) => {
      const evidence = fixtures.alarms.filter((alarm) => incident.evidence_alarm_ids.includes(alarm.alarm_id))
      const lastUpdated = evidence.reduce(
        (latest, alarm) => (parseTime(alarm.timestamp) > parseTime(latest) ? alarm.timestamp : latest),
        evidence[0]?.timestamp ?? datasetAsOf(),
      )
      const openEvidence = evidence.filter((alarm) => isOpenAlarm(alarm.status))
      return {
        incidentId: incident.incident_id,
        title: incident.expected_cause,
        siteId: site.site_id,
        siteName: site.site_name,
        severity: evidence.some((alarm) => alarm.severity === 'critical') ? 'critical' : 'major',
        status: openEvidence.length > 0 ? 'open' : 'resolved',
        lastUpdated,
      }
    })

  const tickets: RecentIncident[] = fixtures.tickets
    .filter((ticket) => ticket.site_id === site.site_id && (!ticket.scenario_id || !covered.has(ticket.scenario_id)))
    .map((ticket) => ({
      incidentId: ticket.ticket_id,
      title: ticket.title,
      siteId: site.site_id,
      siteName: site.site_name,
      severity: PRIORITY_SEVERITY[ticket.priority] ?? 'info',
      status: mapTicketStatus(ticket.status),
      lastUpdated: ticket.created_at,
    }))

  return [...known, ...tickets].sort((left, right) => parseTime(right.lastUpdated) - parseTime(left.lastUpdated))
}

function buildTopology(siteId: string, healthStatus: OperationalStatus): SiteTopology {
  const direct = fixtures.links.filter((link) => link.source_id === siteId || link.target_id === siteId)
  const neighborIds = new Set<string>()
  for (const link of direct) {
    neighborIds.add(link.source_id === siteId ? link.target_id : link.source_id)
  }
  const uplinks = fixtures.links.filter((link) => {
    const touchesNeighbor = neighborIds.has(link.source_id) || neighborIds.has(link.target_id)
    if (!touchesNeighbor) return false
    const other = neighborIds.has(link.source_id) ? link.target_id : link.source_id
    return !other.startsWith('SITE-')
  })
  const edges = [...direct, ...uplinks].filter(
    (link, index, all) => all.findIndex((candidate) => candidate.link_id === link.link_id) === index,
  )

  const nodeIds = new Set<string>([siteId])
  for (const link of edges) {
    nodeIds.add(link.source_id)
    nodeIds.add(link.target_id)
  }

  const nodes: TopologyNode[] = [...nodeIds].map((id) => {
    const kind = id.startsWith('SITE-') ? 'site' : id.startsWith('AGG-') ? 'aggregation' : 'core'
    const site = fixtures.sites.find((item) => item.site_id === id)
    const down = edges.some((link) => (link.source_id === id || link.target_id === id) && link.status === 'down')
    return {
      id,
      label: site?.site_name ?? id,
      kind,
      status: id === siteId ? healthStatus : down ? 'critical' : 'healthy',
    }
  })

  return {
    nodes,
    edges: edges.map((link) => ({
      id: link.link_id,
      from: link.source_id,
      to: link.target_id,
      linkType: link.link_type.replaceAll('_', ' '),
      status: link.status === 'down' ? 'critical' : 'healthy',
      capacityMbps: link.capacity_mbps,
    })),
  }
}

export function buildDemoSiteHealth(siteId: string, range: TimeRange): SiteHealth {
  const site = fixtures.sites.find((item) => item.site_id === siteId)
  if (!site) {
    throw new Error(`Unknown site ${siteId}`)
  }

  const { start, asOf, asOfMs } = windowFor(range)
  const siteAlarms = fixtures.alarms.filter((alarm) => alarm.site_id === siteId)
  const activeAlarms = siteAlarms.filter((alarm) => isOpenAlarm(alarm.status))
  const metrics = fixtures.metrics
    .filter((sample) => sample.site_id === siteId && inWindow(sample.timestamp, start, asOfMs))
    .sort((left, right) => parseTime(left.timestamp) - parseTime(right.timestamp))

  const latest = metrics[metrics.length - 1]
  const unreachable = Boolean(latest && (latest.state === 'abnormal' || latest.latency_ms >= LATENCY_UNAVAILABLE_MS))
  const latencyMs = latest && !unreachable ? latest.latency_ms : null
  const throughputMbps = latest?.throughput_mbps ?? null
  const utilizationPct = latest && !unreachable ? latest.utilization_pct : null
  const droppedCallRatePct = latest?.dropped_call_rate_pct ?? null

  let healthStatus = mapSiteStatus(site.status)
  if (activeAlarms.some((alarm) => alarm.severity === 'critical')) healthStatus = 'critical'
  else if (healthStatus === 'healthy' && activeAlarms.some((alarm) => alarm.severity === 'major')) healthStatus = 'degraded'

  const trends: TrendPoint[] = metrics.map((sample) => ({
    timestamp: sample.timestamp,
    latencyMs: sample.latency_ms >= LATENCY_UNAVAILABLE_MS ? null : sample.latency_ms,
    throughputMbps: sample.throughput_mbps,
    utilizationPct: sample.utilization_pct,
    droppedCallRatePct: sample.dropped_call_rate_pct,
  }))

  const equipment: SiteEquipment[] = fixtures.equipment
    .filter((item) => item.site_id === siteId)
    .map((item) => ({
      equipmentId: item.equipment_id,
      component: item.component.replaceAll('_', ' '),
      vendor: item.vendor,
      softwareVersion: item.software_version,
      operationalState: mapEquipmentState(item.operational_state),
    }))

  const deployments: SiteDeploymentRow[] = fixtures.deployments
    .filter((item) => item.site_id === siteId)
    .sort((left, right) => parseTime(right.timestamp) - parseTime(left.timestamp))
    .map((item) => ({
      deploymentId: item.deployment_id,
      timestamp: item.timestamp,
      changeType: item.change_type,
      versionBefore: item.version_before,
      versionAfter: item.version_after,
      statusLabel: item.status.replaceAll('_', ' '),
      notes: item.notes,
    }))

  return {
    siteId: site.site_id,
    siteName: site.site_name,
    region: site.region,
    technology: site.technology ?? '—',
    vendor: site.vendor ?? '—',
    siteType: site.site_type?.replaceAll('_', ' ') ?? '—',
    criticality: site.criticality ?? '—',
    backhaulType: site.backhaul_type ?? '—',
    healthStatus,
    activeAlarmCount: activeAlarms.length,
    range,
    asOf,
    source: 'demo',
    missingEndpoints: [],
    kpis: {
      latencyMs,
      throughputMbps,
      utilizationPct,
      droppedCallRatePct,
      latencyLevel: classifyKpi('latencyMs', latest?.latency_ms ?? null),
      throughputLevel: classifyKpi('throughputMbps', throughputMbps),
      utilizationLevel: unreachable ? 'unavailable' : classifyKpi('utilizationPct', utilizationPct),
      droppedCallLevel: classifyKpi('droppedCallRatePct', droppedCallRatePct),
    },
    trends,
    equipment,
    activeAlarms: activeAlarms
      .sort((left, right) => parseTime(right.timestamp) - parseTime(left.timestamp))
      .map((alarm) => ({
        alarmId: alarm.alarm_id,
        timestamp: alarm.timestamp,
        code: alarm.alarm_code,
        message: alarm.message,
        severity: mapAlarmSeverity(alarm.severity),
        status: mapAlarmStatus(alarm.status),
      })),
    deployments,
    incidents: siteIncidents(site),
    topology: buildTopology(site.site_id, healthStatus),
  }
}

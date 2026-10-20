import { buildRecommendation } from '@/services/demo/approvalDemo'
import { searchDemoRunbooksForIncident } from '@/services/demo/runbookDemo'
import type { ApprovalRequest } from '@/types/approval'
import { upsertApprovalTimeline } from '@/types/approval'
import type {
  CandidateCause,
  CorrelatedAlarm,
  IncidentInvestigation,
  IncidentListItem,
  NetworkEvidenceItem,
  TimelineEvent,
} from '@/types/incident'
import type { RunbookPassage } from '@/types/runbook'
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

const STORAGE_PREFIX = 'noc.investigation.'
const runningIds = new Set<string>()
const results = new Map<string, IncidentInvestigation>()

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

function datasetAsOf(): string {
  const timestamps = [
    ...fixtures.alarms.map((item) => item.timestamp),
    ...fixtures.metrics.map((item) => item.timestamp),
    ...fixtures.deployments.map((item) => item.timestamp),
    ...fixtures.tickets.map((item) => item.created_at),
  ]
  return new Date(Math.max(...timestamps.map(parseTime))).toISOString()
}

function siteName(siteId: string): string {
  return fixtures.sites.find((site) => site.site_id === siteId)?.site_name ?? siteId
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

function maxSeverity(values: Severity[]): Severity {
  const rank: Record<Severity, number> = { critical: 5, major: 4, warning: 3, minor: 2, info: 1, cleared: 0 }
  return values.reduce<Severity>((highest, current) => (rank[current] > rank[highest] ? current : highest), 'info')
}

function storageKey(id: string): string {
  return `${STORAGE_PREFIX}${id}`
}

function readStored(id: string): IncidentInvestigation | null {
  const memory = results.get(id)
  if (memory) return memory
  try {
    const raw = window.sessionStorage.getItem(storageKey(id))
    if (!raw) return null
    const parsed = JSON.parse(raw) as IncidentInvestigation
    results.set(id, parsed)
    return parsed
  } catch {
    return null
  }
}

function writeStored(investigation: IncidentInvestigation): void {
  results.set(investigation.incidentId, investigation)
  try {
    window.sessionStorage.setItem(storageKey(investigation.incidentId), JSON.stringify(investigation))
  } catch {
    /* session storage is optional */
  }
}

function correlatedAlarms(siteId: string, evidenceIds?: string[]): CorrelatedAlarm[] {
  const selected = evidenceIds?.length
    ? fixtures.alarms.filter((alarm) => evidenceIds.includes(alarm.alarm_id))
    : fixtures.alarms.filter((alarm) => alarm.site_id === siteId).slice(0, 8)
  return selected
    .sort((left, right) => parseTime(left.timestamp) - parseTime(right.timestamp))
    .map((alarm) => ({
      alarmId: alarm.alarm_id,
      severity: mapAlarmSeverity(alarm.severity),
      timestamp: alarm.timestamp,
      siteId: alarm.site_id,
      alarmType: alarm.alarm_code,
      message: alarm.message,
      status: mapAlarmStatus(alarm.status),
    }))
}

function kpiEvents(siteId: string): TimelineEvent[] {
  return fixtures.metrics
    .filter((sample) => sample.site_id === siteId)
    .filter((sample) => (
      sample.state === 'abnormal'
      || classifyKpi('latencyMs', sample.latency_ms) !== 'normal'
      || classifyKpi('utilizationPct', sample.utilization_pct) !== 'normal'
      || classifyKpi('droppedCallRatePct', sample.dropped_call_rate_pct) !== 'normal'
      || classifyKpi('throughputMbps', sample.throughput_mbps) !== 'normal'
    ))
    .sort((left, right) => parseTime(left.timestamp) - parseTime(right.timestamp))
    .slice(-8)
    .map((sample) => ({
      id: sample.metric_id,
      kind: 'kpi' as const,
      timestamp: sample.timestamp,
      title: sample.state === 'abnormal' || sample.latency_ms >= LATENCY_UNAVAILABLE_MS
        ? 'KPI anomaly: site unreachable / abnormal'
        : 'KPI threshold exceeded',
      detail: `Latency ${sample.latency_ms} ms, throughput ${sample.throughput_mbps} Mbps, utilization ${sample.utilization_pct}%, drop ${sample.dropped_call_rate_pct}%`,
      sourceEventId: sample.metric_id,
    }))
}

function evidenceForSite(siteId: string): NetworkEvidenceItem[] {
  const items: NetworkEvidenceItem[] = []
  const latest = [...fixtures.metrics]
    .filter((sample) => sample.site_id === siteId)
    .sort((left, right) => parseTime(left.timestamp) - parseTime(right.timestamp))
    .at(-1)
  if (latest) {
    items.push({
      id: latest.metric_id,
      category: 'metric',
      title: 'Latest site telemetry',
      detail: `Latency ${latest.latency_ms} ms · throughput ${latest.throughput_mbps} Mbps · utilization ${latest.utilization_pct}% · drop ${latest.dropped_call_rate_pct}% (${latest.state})`,
      timestamp: latest.timestamp,
      sourceEventId: latest.metric_id,
    })
  }
  for (const item of fixtures.equipment.filter((record) => record.site_id === siteId)) {
    items.push({
      id: `${item.equipment_id}-${item.component}`,
      category: 'inventory',
      title: `${item.component.replaceAll('_', ' ')} (${item.vendor})`,
      detail: `State ${item.operational_state.replaceAll('_', ' ')} · software ${item.software_version}`,
      timestamp: datasetAsOf(),
      sourceEventId: item.equipment_id,
    })
  }
  for (const link of fixtures.links.filter((record) => record.source_id === siteId || record.target_id === siteId)) {
    items.push({
      id: link.link_id,
      category: 'topology',
      title: `${link.source_id} → ${link.target_id}`,
      detail: `${link.link_type.replaceAll('_', ' ')} · ${link.capacity_mbps} Mbps · ${link.status}`,
      timestamp: datasetAsOf(),
      sourceEventId: link.link_id,
    })
  }
  for (const deployment of fixtures.deployments.filter((record) => record.site_id === siteId)) {
    items.push({
      id: deployment.deployment_id,
      category: 'deployment',
      title: `${deployment.change_type} ${deployment.version_before} → ${deployment.version_after}`,
      detail: `${deployment.status.replaceAll('_', ' ')}. ${deployment.notes}`,
      timestamp: deployment.timestamp,
      sourceEventId: deployment.deployment_id,
    })
  }
  return items
}

function baseTimeline(alarms: CorrelatedAlarm[], siteId: string): TimelineEvent[] {
  const alarmEvents: TimelineEvent[] = alarms.map((alarm) => ({
    id: alarm.alarmId,
    kind: 'alarm',
    timestamp: alarm.timestamp,
    title: alarm.alarmType,
    detail: alarm.message,
    sourceEventId: alarm.alarmId,
  }))
  const deployments: TimelineEvent[] = fixtures.deployments
    .filter((item) => item.site_id === siteId)
    .map((item) => ({
      id: item.deployment_id,
      kind: 'deployment',
      timestamp: item.timestamp,
      title: `Deployment ${item.deployment_id}`,
      detail: `${item.change_type} ${item.version_before} → ${item.version_after} (${item.status.replaceAll('_', ' ')})`,
      sourceEventId: item.deployment_id,
    }))
  return [...alarmEvents, ...kpiEvents(siteId), ...deployments]
    .sort((left, right) => parseTime(left.timestamp) - parseTime(right.timestamp))
}

function hypothesisSet(record: { scenarioId: string | null; siteId: string; evidence: NetworkEvidenceItem[]; alarms: CorrelatedAlarm[] }): CandidateCause[] {
  const latestMetric = record.evidence.find((item) => item.category === 'metric')
  const topology = record.evidence.filter((item) => item.category === 'topology')
  const inventory = record.evidence.filter((item) => item.category === 'inventory')
  const deployments = record.evidence.filter((item) => item.category === 'deployment')
  const downLink = topology.find((item) => item.detail.includes(' down'))
  const faultGear = inventory.filter((item) => item.detail.includes('fault'))
  const alarmRefs = (codes: string[]) => record.alarms
    .filter((alarm) => codes.some((code) => alarm.alarmType.includes(code) || alarm.alarmId === code))
    .map((alarm) => ({
      sourceEventId: alarm.alarmId,
      source: 'alarm',
      timestamp: alarm.timestamp,
      summary: `${alarm.alarmType}: ${alarm.message}`,
    }))

  if (record.scenarioId === 'SCN-OUTAGE-01') {
    return [
      {
        rank: 1,
        title: 'Backhaul path failure',
        hypothesis: 'The site is unreachable because the microwave backhaul link is down, not because of a confirmed radio hardware fault.',
        confidencePct: 78,
        uncertainty: 'medium',
        supporting: [
          ...alarmRefs(['SITE_UNREACHABLE', 'BACKHAUL_LINK_DOWN', 'CELL_AVAILABILITY_LOSS']),
          ...(downLink ? [{ sourceEventId: downLink.sourceEventId, source: 'topology', timestamp: downLink.timestamp, summary: downLink.detail }] : []),
          ...(latestMetric ? [{ sourceEventId: latestMetric.sourceEventId, source: 'telemetry', timestamp: latestMetric.timestamp, summary: latestMetric.detail }] : []),
        ],
        contradictory: inventory
          .filter((item) => item.detail.includes('in service'))
          .slice(0, 1)
          .map((item) => ({
            sourceEventId: item.sourceEventId,
            source: 'inventory',
            timestamp: item.timestamp,
            summary: `${item.title} still reports in service, so radio hardware is not independently verified as failed.`,
          })),
      },
      {
        rank: 2,
        title: 'Baseband or router fault',
        hypothesis: 'A local equipment fault could explain unavailability, but topology evidence currently points at the backhaul link.',
        confidencePct: 24,
        uncertainty: 'high',
        supporting: faultGear.map((item) => ({
          sourceEventId: item.sourceEventId,
          source: 'inventory',
          timestamp: item.timestamp,
          summary: `${item.title}: ${item.detail}`,
        })),
        contradictory: [
          ...(downLink ? [{ sourceEventId: downLink.sourceEventId, source: 'topology', timestamp: downLink.timestamp, summary: 'A down backhaul link better explains site-wide unreachability.' }] : []),
        ],
      },
      {
        rank: 3,
        title: 'Post-deployment regression',
        hypothesis: 'A recent configuration change could cause this outage, but no deployment is recorded on this site.',
        confidencePct: 8,
        uncertainty: 'high',
        supporting: [],
        contradictory: [{
          sourceEventId: 'none',
          source: 'deployment',
          timestamp: datasetAsOf(),
          summary: 'No deployment event is recorded for this site in the synthetic change history.',
        }],
      },
    ]
  }

  if (record.scenarioId === 'SCN-CONGESTION-01') {
    return [
      {
        rank: 1,
        title: 'Radio capacity congestion',
        hypothesis: 'Busy-hour utilization appears to be driving latency and dropped-call degradation. This is a ranked hypothesis, not a closed diagnosis.',
        confidencePct: 71,
        uncertainty: 'medium',
        supporting: [
          ...alarmRefs(['HIGH_PRB_UTILIZATION', 'HIGH_LATENCY', 'THROUGHPUT_DEGRADATION']),
          ...(latestMetric ? [{ sourceEventId: latestMetric.sourceEventId, source: 'telemetry', timestamp: latestMetric.timestamp, summary: latestMetric.detail }] : []),
        ],
        contradictory: topology
          .filter((item) => item.detail.includes(' up'))
          .slice(0, 1)
          .map((item) => ({
            sourceEventId: item.sourceEventId,
            source: 'topology',
            timestamp: item.timestamp,
            summary: `${item.title} is up, which weakens a complete backhaul-outage explanation.`,
          })),
      },
      {
        rank: 2,
        title: 'Backhaul congestion',
        hypothesis: 'The access link may be capacity-constrained even if it is not down.',
        confidencePct: 29,
        uncertainty: 'high',
        supporting: alarmRefs(['HIGH_LATENCY', 'THROUGHPUT_DEGRADATION']),
        contradictory: [{
          sourceEventId: record.alarms[0]?.alarmId ?? 'none',
          source: 'alarm',
          timestamp: record.alarms[0]?.timestamp ?? datasetAsOf(),
          summary: 'A PRB utilization alarm is more specific to radio congestion than to backhaul.',
        }],
      },
      {
        rank: 3,
        title: 'Software change impact',
        hypothesis: 'A recent rollout could contribute, but no matching deployment is attached to this site.',
        confidencePct: 11,
        uncertainty: 'high',
        supporting: [],
        contradictory: [{
          sourceEventId: 'none',
          source: 'deployment',
          timestamp: datasetAsOf(),
          summary: 'No deployment event is recorded for this site around the alarm window.',
        }],
      },
    ]
  }

  if (record.scenarioId === 'SCN-DEPLOY-01') {
    return [
      {
        rank: 1,
        title: 'Configuration regression after rollout',
        hypothesis: 'KPI and accessibility alarms follow a software/configuration deployment. Sequence is suggestive, not proof of cause.',
        confidencePct: 74,
        uncertainty: 'medium',
        supporting: [
          ...alarmRefs(['POST_DEPLOYMENT_KPI_DEGRADATION', 'CONFIGURATION_MISMATCH', 'ACCESSIBILITY_DEGRADATION']),
          ...deployments.map((item) => ({
            sourceEventId: item.sourceEventId,
            source: 'deployment',
            timestamp: item.timestamp,
            summary: item.detail,
          })),
        ],
        contradictory: [{
          sourceEventId: latestMetric?.sourceEventId ?? 'none',
          source: 'telemetry',
          timestamp: latestMetric?.timestamp ?? datasetAsOf(),
          summary: 'The same KPI pattern can also appear during congestion, so deployment timing is not exclusive evidence.',
        }],
      },
      {
        rank: 2,
        title: 'Independent congestion',
        hypothesis: 'Traffic load could explain KPI drop even if a deployment occurred nearby.',
        confidencePct: 31,
        uncertainty: 'high',
        supporting: latestMetric ? [{
          sourceEventId: latestMetric.sourceEventId,
          source: 'telemetry',
          timestamp: latestMetric.timestamp,
          summary: latestMetric.detail,
        }] : [],
        contradictory: alarmRefs(['CONFIGURATION_MISMATCH']).map((item) => ({
          ...item,
          summary: 'A configuration mismatch alarm is not explained by traffic load alone.',
        })),
      },
      {
        rank: 3,
        title: 'Backhaul failure',
        hypothesis: 'A transport fault is less likely while the site remains reachable and the uplink is up.',
        confidencePct: 12,
        uncertainty: 'high',
        supporting: [],
        contradictory: topology.slice(0, 1).map((item) => ({
          sourceEventId: item.sourceEventId,
          source: 'topology',
          timestamp: item.timestamp,
          summary: item.detail,
        })),
      },
    ]
  }

  return [
    {
      rank: 1,
      title: 'Recurring local alarm condition',
      hypothesis: 'Available tickets and alarms suggest a local condition, but correlated evidence is thin.',
      confidencePct: 22,
      uncertainty: 'high',
      supporting: record.alarms.slice(0, 3).map((alarm) => ({
        sourceEventId: alarm.alarmId,
        source: 'alarm',
        timestamp: alarm.timestamp,
        summary: `${alarm.alarmType}: ${alarm.message}`,
      })),
      contradictory: [{
        sourceEventId: 'none',
        source: 'investigation',
        timestamp: datasetAsOf(),
        summary: 'No dense alarm cluster or topology failure is attached to this record.',
      }],
    },
  ]
}

interface Seed {
  incidentId: string
  title: string
  siteId: string
  priority: string
  status: OperationalStatus
  createdAt: string
  scenarioId: string | null
  evidenceAlarmIds?: string[]
}

function seeds(): Seed[] {
  const known: Seed[] = fixtures.incidents.map((incident) => {
    const ticket = fixtures.tickets.find((item) => item.scenario_id === incident.scenario_id)
    const alarms = fixtures.alarms.filter((alarm) => incident.evidence_alarm_ids.includes(alarm.alarm_id))
    const createdAt = alarms.reduce(
      (earliest, alarm) => (parseTime(alarm.timestamp) < parseTime(earliest) ? alarm.timestamp : earliest),
      alarms[0]?.timestamp ?? ticket?.created_at ?? datasetAsOf(),
    )
    return {
      incidentId: incident.incident_id,
      title: ticket?.title ?? `Open incident at ${incident.site_id}`,
      siteId: incident.site_id,
      priority: ticket?.priority ?? (alarms.some((alarm) => alarm.severity === 'critical') ? 'P1' : 'P2'),
      status: ticket ? mapTicketStatus(ticket.status) : 'open',
      createdAt,
      scenarioId: incident.scenario_id,
      evidenceAlarmIds: incident.evidence_alarm_ids,
    }
  })
  const covered = new Set(known.map((item) => item.scenarioId))
  const extras: Seed[] = fixtures.tickets
    .filter((ticket) => !ticket.scenario_id || !covered.has(ticket.scenario_id))
    .map((ticket) => ({
      incidentId: ticket.ticket_id,
      title: ticket.title,
      siteId: ticket.site_id,
      priority: ticket.priority,
      status: mapTicketStatus(ticket.status),
      createdAt: ticket.created_at,
      scenarioId: ticket.scenario_id,
    }))
  return [...known, ...extras]
}

function assemble(seed: Seed): IncidentInvestigation {
  const stored = readStored(seed.incidentId)
  const alarms = correlatedAlarms(seed.siteId, seed.evidenceAlarmIds)
  const evidence = evidenceForSite(seed.siteId)
  const severity = alarms.length > 0 ? maxSeverity(alarms.map((alarm) => alarm.severity)) : (PRIORITY_SEVERITY[seed.priority] ?? 'info')
  const missingEndpoints = [
    '/incidents',
    `/incidents/${seed.incidentId}`,
    `/incidents/${seed.incidentId}/investigate`,
    `/incidents/${seed.incidentId}/approve`,
    `/incidents/${seed.incidentId}/runbooks`,
    '/approvals',
    '/runbooks/search',
  ]
  const base: IncidentInvestigation = {
    incidentId: seed.incidentId,
    title: seed.title,
    severity,
    priority: seed.priority,
    status: seed.status,
    affectedSites: [{ siteId: seed.siteId, siteName: siteName(seed.siteId) }],
    createdAt: seed.createdAt,
    investigationStatus: 'not_started',
    correlatedAlarms: alarms,
    timeline: baseTimeline(alarms, seed.siteId),
    evidence,
    candidates: [],
    runbookPassages: [],
    runbookRetrieval: 'not_requested',
    recommendation: null,
    reportId: null,
    reportHref: null,
    investigationError: null,
    source: 'demo',
    missingEndpoints,
    asOf: datasetAsOf(),
  }
  if (!stored) {
    return withRecommendation(base, seed.scenarioId)
  }
  const staleInProgress = stored.investigationStatus === 'in_progress' && !runningIds.has(seed.incidentId)
  const investigationStatus = staleInProgress
    ? (stored.candidates.length > 0 ? 'completed' : 'not_started')
    : stored.investigationStatus
  const storedPassages = stored.runbookPassages ?? []
  const backfill = investigationStatus === 'completed' && storedPassages.length === 0 && stored.runbookRetrieval !== 'empty' && stored.runbookRetrieval !== 'failed'
    ? searchDemoRunbooksForIncident({
        incidentId: seed.incidentId,
        title: seed.title,
        alarmTypes: alarms.map((alarm) => alarm.alarmType),
      })
    : null
  return withRecommendation({
    ...base,
    investigationStatus,
    candidates: stored.candidates,
    runbookPassages: backfill ? backfill.passages : storedPassages,
    runbookRetrieval: backfill
      ? (backfill.passages.length > 0 ? 'retrieved' : 'empty')
      : (stored.runbookRetrieval ?? (investigationStatus === 'completed' ? 'empty' : 'not_requested')),
    timeline: stored.timeline.length > 0 ? stored.timeline : base.timeline,
    reportId: stored.reportId,
    reportHref: stored.reportHref,
    investigationError: staleInProgress && investigationStatus !== 'completed' ? null : stored.investigationError,
  }, seed.scenarioId)
}

function withRecommendation(incident: IncidentInvestigation, scenarioId: string | null): IncidentInvestigation {
  const passages = incident.runbookPassages.length > 0
    ? incident.runbookPassages
    : (scenarioId
      ? searchDemoRunbooksForIncident({
          incidentId: incident.incidentId,
          title: incident.title,
          alarmTypes: incident.correlatedAlarms.map((alarm) => alarm.alarmType),
        }).passages
      : [])
  const recommendation = buildRecommendation({
    incidentId: incident.incidentId,
    title: incident.title,
    severity: incident.severity,
    priority: incident.priority,
    requestedAt: incident.createdAt,
    candidates: incident.candidates,
    runbookPassages: passages,
    alarms: incident.correlatedAlarms,
    includePending: Boolean(scenarioId) || incident.investigationStatus === 'completed',
  })
  if (!recommendation) return { ...incident, recommendation: null }
  return {
    ...incident,
    recommendation,
    timeline: upsertApprovalTimeline(incident.timeline, recommendation),
  }
}

export function listDemoIncidents(): IncidentListItem[] {
  return seeds().map((seed) => {
    const investigation = assemble(seed)
    return {
      incidentId: investigation.incidentId,
      title: investigation.title,
      siteId: investigation.affectedSites[0]?.siteId ?? seed.siteId,
      siteName: investigation.affectedSites[0]?.siteName ?? seed.siteId,
      severity: investigation.severity,
      priority: investigation.priority,
      status: investigation.status,
      createdAt: investigation.createdAt,
      investigationStatus: investigation.investigationStatus,
      reportId: investigation.reportId,
    }
  })
}

export function buildDemoIncident(incidentId: string): IncidentInvestigation {
  const seed = seeds().find((item) => item.incidentId === incidentId)
  if (!seed) throw new Error(`Unknown incident ${incidentId}`)
  return assemble(seed)
}

export async function runDemoInvestigate(incidentId: string): Promise<IncidentInvestigation> {
  if (runningIds.has(incidentId)) {
    throw new Error('An investigation is already running for this incident.')
  }
  runningIds.add(incidentId)
  const current = buildDemoIncident(incidentId)
  current.investigationStatus = 'in_progress'
  current.investigationError = null
  writeStored(current)

  await new Promise((resolve) => window.setTimeout(resolve, 1400))

  try {
    const seed = seeds().find((item) => item.incidentId === incidentId)
    if (!seed) throw new Error(`Unknown incident ${incidentId}`)
    const finishedAt = new Date().toISOString()
    const reportId = `RPT-${incidentId}`
    const candidates = hypothesisSet({
      scenarioId: seed.scenarioId,
      siteId: seed.siteId,
      evidence: current.evidence,
      alarms: current.correlatedAlarms,
    })
    const priorTimeline = current.timeline.filter((event) => event.kind !== 'investigation' && event.kind !== 'approval')
    const runbooks = searchDemoRunbooksForIncident({
      incidentId,
      title: seed.title,
      alarmTypes: current.correlatedAlarms.map((alarm) => alarm.alarmType),
    })
    const steps: TimelineEvent[] = [
      {
        id: `${incidentId}-inv-collect`,
        kind: 'investigation',
        timestamp: finishedAt,
        title: 'Collected correlated alarms and telemetry',
        detail: 'Synthetic investigation step. Evidence IDs were preserved; no live collector was queried.',
        sourceEventId: `${incidentId}-inv-collect`,
      },
      {
        id: `${incidentId}-inv-runbooks`,
        kind: 'investigation',
        timestamp: finishedAt,
        title: runbooks.passages.length > 0
          ? `Retrieved ${runbooks.passages.length} runbook passage${runbooks.passages.length === 1 ? '' : 's'}`
          : 'Runbook retrieval returned no relevant passages',
        detail: runbooks.passages.length > 0
          ? `Sources: ${runbooks.passages.map((item) => item.sourceRef).join('; ')}. These documents are not a verified root cause.`
          : 'No procedure was generated. The knowledge index had no matching passage for this incident context.',
        sourceEventId: `${incidentId}-inv-runbooks`,
      },
      {
        id: `${incidentId}-inv-rank`,
        kind: 'investigation',
        timestamp: finishedAt,
        title: 'Ranked candidate causes',
        detail: 'Output is a hypothesis list for operator review. It is not a verified root cause.',
        sourceEventId: `${incidentId}-inv-rank`,
      },
    ]
    const draft: IncidentInvestigation = {
      ...current,
      investigationStatus: 'completed',
      candidates,
      runbookPassages: runbooks.passages,
      runbookRetrieval: runbooks.passages.length > 0 ? 'retrieved' : 'empty',
      timeline: [...priorTimeline, ...steps].sort((left, right) => parseTime(left.timestamp) - parseTime(right.timestamp)),
      reportId,
      reportHref: `/reports?incident=${encodeURIComponent(incidentId)}&report=${encodeURIComponent(reportId)}`,
      investigationError: null,
    }
    const completed = withRecommendation(draft, seed.scenarioId)
    writeStored(completed)
    return completed
  } catch (error) {
    const failed: IncidentInvestigation = {
      ...current,
      investigationStatus: 'failed',
      investigationError: error instanceof Error ? error.message : 'Investigation failed.',
      candidates: [],
      runbookPassages: [],
      runbookRetrieval: 'failed',
      recommendation: current.recommendation,
      reportId: null,
      reportHref: null,
    }
    writeStored(failed)
    return failed
  } finally {
    runningIds.delete(incidentId)
  }
}

export function isInvestigationRunning(incidentId: string): boolean {
  return runningIds.has(incidentId)
}

export function storeDemoRunbookEvidence(incidentId: string, passages: RunbookPassage[]): IncidentInvestigation {
  const current = buildDemoIncident(incidentId)
  const seed = seeds().find((item) => item.incidentId === incidentId)
  const next = withRecommendation({
    ...current,
    runbookPassages: passages,
    runbookRetrieval: passages.length > 0 ? 'retrieved' : 'empty',
  }, seed?.scenarioId ?? null)
  writeStored(next)
  return next
}

export function attachDemoApproval(incidentId: string, approval: ApprovalRequest): IncidentInvestigation {
  const current = buildDemoIncident(incidentId)
  const next: IncidentInvestigation = {
    ...current,
    recommendation: approval,
    timeline: upsertApprovalTimeline(current.timeline, approval),
  }
  writeStored(next)
  return next
}

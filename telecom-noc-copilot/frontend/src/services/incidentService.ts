import { normalizeApproval } from '@/services/approvalService'
import { listAlarms } from '@/services/alarmService'
import { getIncidentRunbooks } from '@/services/runbookService'
import { ApiError, apiGet, apiPost, isMissingEndpoint } from '@/services/httpClient'
import { isRecord, readString, readStringArray, unwrapList } from '@/services/jsonParse'
import type { AlarmListItem } from '@/types/alarm'
import type {
  CorrelatedAlarm,
  IncidentInvestigation,
  IncidentListItem,
  InvestigationStatus,
  TimelineEvent,
} from '@/types/incident'
import type { OperationalStatus } from '@/types/ui'

export const INCIDENTS_ENDPOINT = '/incidents'
export const incidentDetailEndpoint = (incidentId: string) => `/incidents/${incidentId}`
export const incidentInvestigateEndpoint = (incidentId: string) => `/incidents/${incidentId}/investigate`

const INVESTIGATE_TIMEOUT_MS = 12000

function mapIncidentStatus(status: string | undefined): OperationalStatus {
  const normalized = (status ?? 'open').toLowerCase().replaceAll('_', '-')
  if (normalized === 'open') return 'open'
  if (normalized === 'investigating' || normalized === 'in-progress') return 'in-progress'
  if (normalized === 'awaiting-approval' || normalized === 'pending') return 'pending'
  if (normalized === 'resolved' || normalized === 'closed' || normalized === 'cleared') return 'resolved'
  if (normalized === 'approved') return 'approved'
  return 'open'
}

function mapInvestigationStatus(status: string | undefined): InvestigationStatus {
  const normalized = (status ?? '').toLowerCase().replaceAll('_', '-')
  if (normalized === 'investigating' || normalized === 'in-progress') return 'in_progress'
  if (normalized === 'awaiting-approval' || normalized === 'completed' || normalized === 'closed') return 'completed'
  if (normalized === 'failed') return 'failed'
  return 'not_started'
}

function normalizeListItem(value: unknown): IncidentListItem | null {
  if (!isRecord(value)) return null
  const incidentId = readString(value, 'incidentId', 'incident_id')
  if (!incidentId) return null
  const status = mapIncidentStatus(readString(value, 'status'))
  const investigationStatus = (readString(value, 'investigationStatus', 'investigation_status')
    ?? mapInvestigationStatus(readString(value, 'status'))) as InvestigationStatus
  return {
    incidentId,
    title: readString(value, 'title') ?? incidentId,
    siteId: readString(value, 'siteId', 'site_id') ?? 'unknown',
    siteName: readString(value, 'siteName', 'site_name') ?? readString(value, 'siteId', 'site_id') ?? 'Unknown site',
    severity: (readString(value, 'severity') ?? 'info') as IncidentListItem['severity'],
    priority: readString(value, 'priority') ?? 'P3',
    status,
    createdAt: readString(value, 'createdAt', 'created_at') ?? new Date().toISOString(),
    investigationStatus,
    reportId: readString(value, 'reportId', 'report_id') ?? null,
  }
}

function toCorrelated(alarm: AlarmListItem): CorrelatedAlarm {
  return {
    alarmId: alarm.alarmId,
    severity: alarm.severity,
    timestamp: alarm.timestamp,
    siteId: alarm.siteId,
    alarmType: alarm.alarmType,
    message: alarm.message,
    status: alarm.status,
  }
}

function toTimeline(alarms: CorrelatedAlarm[]): TimelineEvent[] {
  return [...alarms]
    .sort((left, right) => left.timestamp.localeCompare(right.timestamp))
    .map((alarm) => ({
      id: alarm.alarmId,
      kind: 'alarm' as const,
      timestamp: alarm.timestamp,
      title: alarm.alarmType,
      detail: alarm.message,
      sourceEventId: alarm.alarmId,
    }))
}

async function loadEvidenceAlarms(
  siteId: string,
  evidenceIds: string[],
  signal?: AbortSignal,
): Promise<AlarmListItem[]> {
  if (evidenceIds.length === 0 && !siteId) return []
  const listed = await listAlarms(
    {
      siteId: siteId || undefined,
      sort: 'timestamp',
      dir: 'desc',
      page: 1,
      pageSize: 100,
    },
    signal,
  )
  if (evidenceIds.length === 0) return listed.items
  const wanted = new Set(evidenceIds)
  return listed.items.filter((item) => wanted.has(item.alarmId))
}

function assembleInvestigation(
  payload: unknown,
  incidentId: string,
  alarms: AlarmListItem[],
): IncidentInvestigation {
  const record = isRecord(payload) ? payload : {}
  const siteId = readString(record, 'siteId', 'site_id') ?? alarms[0]?.siteId ?? 'unknown'
  const siteName = readString(record, 'siteName', 'site_name') ?? siteId
  const affected = readStringArray(record.affectedSites ?? record.affected_sites)
  const sites = (affected.length ? affected : [siteId]).map((id) => ({
    siteId: id,
    siteName: id === siteId ? siteName : id,
  }))
  const status = mapIncidentStatus(readString(record, 'status'))
  const correlated = alarms.map(toCorrelated)
  const createdAt = readString(record, 'createdAt', 'created_at') ?? new Date().toISOString()
  return {
    incidentId: readString(record, 'incidentId', 'incident_id') ?? incidentId,
    title: readString(record, 'title') ?? incidentId,
    severity: (readString(record, 'severity') ?? 'info') as IncidentInvestigation['severity'],
    priority: readString(record, 'priority') ?? 'P3',
    status,
    affectedSites: sites,
    createdAt,
    investigationStatus: mapInvestigationStatus(readString(record, 'investigationStatus', 'investigation_status') ?? readString(record, 'status')),
    correlatedAlarms: correlated,
    timeline: toTimeline(correlated),
    evidence: correlated.map((alarm) => ({
      id: alarm.alarmId,
      category: 'metric',
      title: alarm.alarmType,
      detail: alarm.message,
      timestamp: alarm.timestamp,
      sourceEventId: alarm.alarmId,
    })),
    candidates: [],
    runbookPassages: [],
    runbookRetrieval: 'not_requested',
    recommendation: normalizeApproval(record.recommendation) ?? null,
    reportId: readString(record, 'reportId', 'report_id') ?? null,
    reportHref: null,
    investigationError: null,
    source: 'api',
    missingEndpoints: [],
    asOf: readString(record, 'updated_at', 'updatedAt', 'created_at', 'createdAt') ?? createdAt,
  }
}

function isInvestigation(value: unknown): boolean {
  if (!isRecord(value)) return false
  if (typeof (value.incidentId ?? value.incident_id) !== 'string') return false
  return Array.isArray(value.correlatedAlarms) || Array.isArray(value.correlated_alarms)
}

export interface IncidentListResult {
  items: IncidentListItem[]
  source: 'api' | 'demo'
  asOf: string
  missingEndpoints: string[]
}

export async function listIncidents(filters: { status?: string; siteId?: string } = {}, signal?: AbortSignal): Promise<IncidentListResult> {
  const query: Record<string, string> = { page_size: '100' }
  if (filters.status) query.status = filters.status
  if (filters.siteId) query.site_id = filters.siteId
  const payload = await apiGet<unknown>(INCIDENTS_ENDPOINT, { signal, query })
  const rows = unwrapList(payload, 'incidents', 'items')
  const items = rows.map(normalizeListItem).filter((item): item is IncidentListItem => Boolean(item))
  if (items.length === 0 && rows.length > 0) {
    throw new ApiError('FastAPI incident list payload was not recognized', 502, INCIDENTS_ENDPOINT)
  }
  return {
    items,
    source: 'api',
    asOf: items[0]?.createdAt ?? new Date().toISOString(),
    missingEndpoints: [],
  }
}

export async function getIncident(incidentId: string, signal?: AbortSignal): Promise<IncidentInvestigation> {
  const path = incidentDetailEndpoint(incidentId)
  const payload = await apiGet<unknown>(path, { signal })
  if (!isRecord(payload) || !readString(payload, 'incidentId', 'incident_id')) {
    throw new ApiError('FastAPI incident payload was not recognized', 502, path)
  }
  if (isInvestigation(payload)) {
    const investigation = payload as unknown as IncidentInvestigation
    return {
      ...investigation,
      incidentId: investigation.incidentId ?? incidentId,
      runbookPassages: investigation.runbookPassages ?? [],
      runbookRetrieval: investigation.runbookRetrieval ?? 'not_requested',
      recommendation: normalizeApproval(investigation.recommendation) ?? investigation.recommendation ?? null,
      source: 'api',
      missingEndpoints: [],
    }
  }
  const siteId = readString(payload, 'siteId', 'site_id') ?? ''
  const evidenceIds = readStringArray(payload.evidence_alarm_ids ?? payload.evidenceAlarmIds)
  const alarms = await loadEvidenceAlarms(siteId, evidenceIds, signal)
  return assembleInvestigation(payload, incidentId, alarms)
}

export async function investigateIncident(
  incidentId: string,
  options: { signal?: AbortSignal } = {},
): Promise<IncidentInvestigation> {
  const path = incidentInvestigateEndpoint(incidentId)
  const payload = await apiPost<unknown>(path, {}, { signal: options.signal, timeoutMs: INVESTIGATE_TIMEOUT_MS })
  if (!isRecord(payload) || !readString(payload, 'incidentId', 'incident_id')) {
    throw new ApiError('FastAPI investigation payload was not recognized', 502, path)
  }
  if (isInvestigation(payload)) {
    const investigation = payload as unknown as IncidentInvestigation
    return {
      ...investigation,
      incidentId: investigation.incidentId ?? incidentId,
      runbookPassages: investigation.runbookPassages ?? [],
      runbookRetrieval: investigation.runbookRetrieval ?? (investigation.candidates?.length ? 'empty' : 'not_requested'),
      recommendation: normalizeApproval(investigation.recommendation) ?? investigation.recommendation ?? null,
      source: 'api',
      missingEndpoints: [],
    }
  }
  return assembleInvestigation(payload, incidentId, [])
}

export async function retrieveIncidentRunbooks(
  incident: IncidentInvestigation,
  options: { signal?: AbortSignal } = {},
): Promise<IncidentInvestigation> {
  try {
    const result = await getIncidentRunbooks(
      incident.incidentId,
      {
        title: incident.title,
        alarmTypes: incident.correlatedAlarms.map((alarm) => alarm.alarmType),
      },
      options,
    )
    return {
      ...incident,
      runbookPassages: result.passages,
      runbookRetrieval: result.passages.length > 0 ? 'retrieved' : 'empty',
    }
  } catch (error) {
    if (isMissingEndpoint(error)) {
      return { ...incident, runbookPassages: [], runbookRetrieval: 'empty' }
    }
    throw error
  }
}

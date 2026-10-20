import { normalizeApproval } from '@/services/approvalService'
import {
  buildDemoIncident,
  isInvestigationRunning,
  listDemoIncidents,
  runDemoInvestigate,
  storeDemoRunbookEvidence,
} from '@/services/demo/incidentDemo'
import { rememberInfrastructureGap, shouldSkipUnreachableRoute } from '@/services/endpointStatus'
import { getIncidentRunbooks } from '@/services/runbookService'
import { ApiError, apiGet, apiPost, isMissingEndpoint } from '@/services/httpClient'
import { isRecord, readString, unwrapList } from '@/services/jsonParse'
import type { IncidentInvestigation, IncidentListItem, InvestigationStatus } from '@/types/incident'
import { canUseDemoFallback } from '@/utils/config'

/**
 * FastAPI contracts used by Incident Investigation. The current backend scaffold
 * does not implement these routes.
 *
 * GET /incidents
 * GET /incidents/{incident_id}
 * POST /incidents/{incident_id}/investigate
 * POST /incidents/{incident_id}/approve
 * GET  /incidents/{incident_id}/report
 */
export const INCIDENTS_ENDPOINT = '/incidents'
export const incidentDetailEndpoint = (incidentId: string) => `/incidents/${incidentId}`
export const incidentInvestigateEndpoint = (incidentId: string) => `/incidents/${incidentId}/investigate`

const INVESTIGATE_TIMEOUT_MS = 12000

function normalizeListItem(value: unknown): IncidentListItem | null {
  if (!isRecord(value)) return null
  const incidentId = readString(value, 'incidentId', 'incident_id')
  if (!incidentId) return null
  const status = readString(value, 'status') ?? 'open'
  const investigationStatus = (readString(value, 'investigationStatus', 'investigation_status') ?? 'not_started') as InvestigationStatus
  return {
    incidentId,
    title: readString(value, 'title') ?? incidentId,
    siteId: readString(value, 'siteId', 'site_id') ?? 'unknown',
    siteName: readString(value, 'siteName', 'site_name') ?? readString(value, 'siteId', 'site_id') ?? 'Unknown site',
    severity: (readString(value, 'severity') ?? 'info') as IncidentListItem['severity'],
    priority: readString(value, 'priority') ?? 'P3',
    status: status as IncidentListItem['status'],
    createdAt: readString(value, 'createdAt', 'created_at') ?? new Date().toISOString(),
    investigationStatus,
    reportId: readString(value, 'reportId', 'report_id') ?? null,
  }
}

function isInvestigation(value: unknown): value is IncidentInvestigation {
  return isRecord(value) && typeof (value.incidentId ?? value.incident_id) === 'string' && Array.isArray(value.correlatedAlarms ?? value.correlated_alarms ?? [])
}

export interface IncidentListResult {
  items: IncidentListItem[]
  source: 'api' | 'demo'
  asOf: string
  missingEndpoints: string[]
}

export async function listIncidents(filters: { status?: string; siteId?: string } = {}, signal?: AbortSignal): Promise<IncidentListResult> {
  try {
    const query: Record<string, string> = {}
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
  } catch (error) {
    if (canUseDemoFallback() && isMissingEndpoint(error)) {
      const items = listDemoIncidents().filter((item) => {
        if (filters.siteId && item.siteId !== filters.siteId) return false
        if (filters.status === 'open') {
          return item.status === 'open' || item.status === 'in-progress' || item.status === 'acknowledged'
        }
        if (filters.status && item.status !== filters.status) return false
        return true
      })
      return {
        items,
        source: 'demo',
        asOf: items.reduce((latest, item) => (item.createdAt > latest ? item.createdAt : latest), items[0]?.createdAt ?? new Date().toISOString()),
        missingEndpoints: [INCIDENTS_ENDPOINT],
      }
    }
    throw error
  }
}

export async function getIncident(incidentId: string, signal?: AbortSignal): Promise<IncidentInvestigation> {
  const path = incidentDetailEndpoint(incidentId)
  try {
    const payload = await apiGet<unknown>(path, { signal })
    if (!isInvestigation(payload)) {
      throw new ApiError('FastAPI incident payload was not recognized', 502, path)
    }
    return {
      ...payload,
      incidentId: payload.incidentId ?? incidentId,
      runbookPassages: payload.runbookPassages ?? [],
      runbookRetrieval: payload.runbookRetrieval ?? 'not_requested',
      recommendation: normalizeApproval(payload.recommendation) ?? payload.recommendation ?? null,
      source: 'api',
      missingEndpoints: [],
    }
  } catch (error) {
    if (canUseDemoFallback() && isMissingEndpoint(error)) {
      try {
        return buildDemoIncident(incidentId)
      } catch {
        throw new ApiError(`Incident ${incidentId} was not found`, 404, path)
      }
    }
    throw error
  }
}

export async function investigateIncident(
  incidentId: string,
  options: { signal?: AbortSignal } = {},
): Promise<IncidentInvestigation> {
  if (isInvestigationRunning(incidentId)) {
    throw new ApiError('An investigation is already running for this incident.', 409, incidentInvestigateEndpoint(incidentId))
  }

  const path = incidentInvestigateEndpoint(incidentId)
  if (canUseDemoFallback() && shouldSkipUnreachableRoute(path)) {
    return runDemoInvestigate(incidentId)
  }

  try {
    const payload = await apiPost<unknown>(path, {}, { signal: options.signal, timeoutMs: INVESTIGATE_TIMEOUT_MS })
    if (!isInvestigation(payload)) {
      throw new ApiError('FastAPI investigation payload was not recognized', 502, path)
    }
    return {
      ...payload,
      incidentId: payload.incidentId ?? incidentId,
      runbookPassages: payload.runbookPassages ?? [],
      runbookRetrieval: payload.runbookRetrieval ?? (payload.candidates?.length ? 'empty' : 'not_requested'),
      recommendation: normalizeApproval(payload.recommendation) ?? payload.recommendation ?? null,
      source: 'api',
      missingEndpoints: [],
    }
  } catch (error) {
    rememberInfrastructureGap(path, error)
    if (canUseDemoFallback() && isMissingEndpoint(error)) {
      return runDemoInvestigate(incidentId)
    }
    throw error
  }
}

export async function retrieveIncidentRunbooks(
  incident: IncidentInvestigation,
  options: { signal?: AbortSignal } = {},
): Promise<IncidentInvestigation> {
  const result = await getIncidentRunbooks(
    incident.incidentId,
    {
      title: incident.title,
      alarmTypes: incident.correlatedAlarms.map((alarm) => alarm.alarmType),
    },
    options,
  )
  if (incident.source === 'demo' && canUseDemoFallback()) {
    return storeDemoRunbookEvidence(incident.incidentId, result.passages)
  }
  return {
    ...incident,
    runbookPassages: result.passages,
    runbookRetrieval: result.passages.length > 0 ? 'retrieved' : 'empty',
  }
}

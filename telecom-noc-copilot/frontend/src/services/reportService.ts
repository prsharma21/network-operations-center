import { normalizeApproval } from '@/services/approvalService'
import { composeIncidentReport, incidentReportEndpoint, listDemoReports } from '@/services/demo/reportDemo'
import { rememberInfrastructureGap, shouldSkipUnreachableRoute } from '@/services/endpointStatus'
import { ApiError, apiGet, isMissingEndpoint } from '@/services/httpClient'
import { getIncident, listIncidents } from '@/services/incidentService'
import { isRecord, readString } from '@/services/jsonParse'
import type { IncidentInvestigation } from '@/types/incident'
import type { IncidentReport, ReportCatalogResult, ReportListItem } from '@/types/report'
import { kpiAnomaliesFrom, reportAuditFrom, reportSummary } from '@/types/report'
import { canUseDemoFallback } from '@/utils/config'

/**
 * FastAPI contracts used by the Incident Report page. The current backend
 * scaffold does not implement the report route.
 *
 * GET /incidents/{incident_id}/report
 * Falls back to GET /incidents and GET /incidents/{incident_id} without
 * inventing missing evidence, approvals, or executed actions.
 */
export { incidentReportEndpoint }

function unwrapReport(value: unknown): unknown {
  if (!isRecord(value)) return value
  if (isRecord(value.report)) return value.report
  return value
}

function isReportPayload(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false
  return typeof (value.incidentId ?? value.incident_id) === 'string'
}

function normalizeReport(value: unknown, incidentId: string, fallback?: IncidentInvestigation): IncidentReport | null {
  const payload = unwrapReport(value)
  if (!isReportPayload(payload)) return null
  const id = readString(payload, 'incidentId', 'incident_id') ?? incidentId
  const reportId = readString(payload, 'reportId', 'report_id')
  if (!reportId && !fallback?.reportId) return null

  const timeline = Array.isArray(payload.timeline) ? payload.timeline : fallback?.timeline ?? []
  const alarms = Array.isArray(payload.correlatedAlarms ?? payload.correlated_alarms)
    ? (payload.correlatedAlarms ?? payload.correlated_alarms)
    : fallback?.correlatedAlarms ?? []
  const candidates = Array.isArray(payload.candidates) ? payload.candidates : fallback?.candidates ?? []
  const passages = Array.isArray(payload.runbookPassages ?? payload.runbook_passages)
    ? (payload.runbookPassages ?? payload.runbook_passages)
    : fallback?.runbookPassages ?? []
  const recommendation = normalizeApproval(payload.recommendation ?? payload.approval)
    ?? fallback?.recommendation
    ?? null
  const kpi = Array.isArray(payload.kpiAnomalies ?? payload.kpi_anomalies)
    ? (payload.kpiAnomalies ?? payload.kpi_anomalies)
    : kpiAnomaliesFrom(timeline as IncidentReport['timeline'])

  const investigationStatus = (readString(payload, 'investigationStatus', 'investigation_status')
    ?? fallback?.investigationStatus
    ?? 'not_started') as IncidentReport['investigationStatus']

  const draft = {
    title: readString(payload, 'title', 'summary_title') ?? fallback?.title ?? id,
    status: (readString(payload, 'status') ?? fallback?.status ?? 'open') as IncidentReport['status'],
    investigationStatus,
    recommendation,
  }

  return {
    reportId: reportId ?? fallback?.reportId ?? id,
    incidentId: id,
    title: draft.title,
    summary: readString(payload, 'summary') ?? reportSummary(draft),
    severity: (readString(payload, 'severity') ?? fallback?.severity ?? 'info') as IncidentReport['severity'],
    priority: readString(payload, 'priority') ?? fallback?.priority ?? 'P3',
    status: draft.status,
    affectedSites: Array.isArray(payload.affectedSites ?? payload.affected_sites)
      ? (payload.affectedSites ?? payload.affected_sites) as IncidentReport['affectedSites']
      : fallback?.affectedSites ?? [],
    createdAt: readString(payload, 'createdAt', 'created_at') ?? fallback?.createdAt ?? new Date().toISOString(),
    generatedAt: readString(payload, 'generatedAt', 'generated_at', 'created_at') ?? fallback?.asOf ?? new Date().toISOString(),
    investigationStatus,
    timeline: timeline as IncidentReport['timeline'],
    correlatedAlarms: alarms as IncidentReport['correlatedAlarms'],
    kpiAnomalies: kpi as IncidentReport['kpiAnomalies'],
    candidates: candidates as IncidentReport['candidates'],
    runbookPassages: passages as IncidentReport['runbookPassages'],
    runbookRetrieval: (readString(payload, 'runbookRetrieval', 'runbook_retrieval') ?? fallback?.runbookRetrieval ?? 'not_requested') as IncidentReport['runbookRetrieval'],
    recommendation,
    actionStatus: 'not_executed',
    audit: Array.isArray(payload.audit)
      ? payload.audit as IncidentReport['audit']
      : recommendation?.audit ?? (fallback ? reportAuditFrom(fallback) : []),
    source: 'api',
    missingEndpoints: [],
    asOf: readString(payload, 'asOf', 'as_of') ?? fallback?.asOf ?? new Date().toISOString(),
  }
}

async function composeFromIncident(
  incidentId: string,
  requestedReportId: string | undefined,
  signal: AbortSignal | undefined,
  missingEndpoints: string[],
): Promise<IncidentReport> {
  const incident = await getIncident(incidentId, signal)
  const report = composeIncidentReport(incident, requestedReportId)
  return {
    ...report,
    missingEndpoints: Array.from(new Set([...missingEndpoints, ...report.missingEndpoints])),
  }
}

export async function getIncidentReport(
  incidentId: string,
  options: { reportId?: string; signal?: AbortSignal } = {},
): Promise<IncidentReport> {
  const path = incidentReportEndpoint(incidentId)
  if (canUseDemoFallback() && shouldSkipUnreachableRoute(path)) {
    return composeFromIncident(incidentId, options.reportId, options.signal, [path])
  }
  try {
    const payload = await apiGet<unknown>(path, { signal: options.signal })
    const report = normalizeReport(payload, incidentId)
    if (!report) {
      throw new ApiError('FastAPI incident report payload was not recognized', 502, path)
    }
    if (options.reportId && options.reportId !== report.reportId) {
      throw new ApiError(`Report ${options.reportId} was not found for ${incidentId}.`, 404, path)
    }
    return report
  } catch (error) {
    rememberInfrastructureGap(path, error)
    if (canUseDemoFallback() && isMissingEndpoint(error)) {
      return composeFromIncident(incidentId, options.reportId, options.signal, [path])
    }
    throw error
  }
}

export async function listIncidentReports(signal?: AbortSignal): Promise<ReportCatalogResult> {
  try {
    const listed = await listIncidents({}, signal)
    const items: ReportListItem[] = listed.items.flatMap((item) => {
      if (!item.reportId) return []
      return [{
        incidentId: item.incidentId,
        reportId: item.reportId,
        title: item.title,
        severity: item.severity,
        status: item.status,
        createdAt: item.createdAt,
        generatedAt: item.createdAt,
      }]
    })
    if (listed.source === 'api') {
      return {
        items,
        source: 'api',
        asOf: listed.asOf,
        missingEndpoints: [],
      }
    }
    const demo = listDemoReports()
    return {
      items: demo,
      source: 'demo',
      asOf: demo[0]?.generatedAt ?? listed.asOf,
      missingEndpoints: Array.from(new Set([...listed.missingEndpoints, '/incidents/{incident_id}/report'])),
    }
  } catch (error) {
    if (canUseDemoFallback() && isMissingEndpoint(error)) {
      const demo = listDemoReports()
      return {
        items: demo,
        source: 'demo',
        asOf: demo[0]?.generatedAt ?? new Date().toISOString(),
        missingEndpoints: ['/incidents', '/incidents/{incident_id}/report'],
      }
    }
    throw error
  }
}

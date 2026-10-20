import { buildDemoIncident, listDemoIncidents } from '@/services/demo/incidentDemo'
import { ApiError } from '@/services/httpClient'
import type { IncidentInvestigation } from '@/types/incident'
import type { IncidentReport, ReportListItem } from '@/types/report'
import { kpiAnomaliesFrom, reportAuditFrom, reportSummary } from '@/types/report'

export function incidentReportEndpoint(incidentId: string): string {
  return `/incidents/${incidentId}/report`
}

export function composeIncidentReport(
  incident: IncidentInvestigation,
  requestedReportId?: string,
): IncidentReport {
  const path = incidentReportEndpoint(incident.incidentId)
  if (!incident.reportId) {
    throw new ApiError(`No report is available for ${incident.incidentId}. Investigate the incident first.`, 404, path)
  }
  if (requestedReportId && requestedReportId !== incident.reportId) {
    throw new ApiError(`Report ${requestedReportId} was not found for ${incident.incidentId}.`, 404, path)
  }

  const generatedAt = incident.timeline
    .filter((event) => event.kind === 'investigation')
    .map((event) => event.timestamp)
    .sort()
    .at(-1) ?? incident.asOf

  return {
    reportId: incident.reportId,
    incidentId: incident.incidentId,
    title: incident.title,
    summary: reportSummary(incident),
    severity: incident.severity,
    priority: incident.priority,
    status: incident.status,
    affectedSites: incident.affectedSites,
    createdAt: incident.createdAt,
    generatedAt,
    investigationStatus: incident.investigationStatus,
    timeline: incident.timeline,
    correlatedAlarms: incident.correlatedAlarms,
    kpiAnomalies: kpiAnomaliesFrom(incident.timeline),
    candidates: incident.candidates,
    runbookPassages: incident.runbookPassages,
    runbookRetrieval: incident.runbookRetrieval,
    recommendation: incident.recommendation,
    actionStatus: 'not_executed',
    audit: reportAuditFrom(incident),
    source: incident.source,
    missingEndpoints: Array.from(new Set([...incident.missingEndpoints, path])),
    asOf: incident.asOf,
  }
}

export function buildDemoReport(incidentId: string, requestedReportId?: string): IncidentReport {
  try {
    return composeIncidentReport(buildDemoIncident(incidentId), requestedReportId)
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(`Incident ${incidentId} was not found`, 404, incidentReportEndpoint(incidentId))
  }
}

export function listDemoReports(): ReportListItem[] {
  return listDemoIncidents().flatMap((item) => {
    if (!item.reportId) return []
    const incident = buildDemoIncident(item.incidentId)
    if (!incident.reportId) return []
    const generatedAt = incident.timeline
      .filter((event) => event.kind === 'investigation')
      .map((event) => event.timestamp)
      .sort()
      .at(-1) ?? incident.asOf
    return [{
      incidentId: incident.incidentId,
      reportId: incident.reportId,
      title: incident.title,
      severity: incident.severity,
      status: incident.status,
      createdAt: incident.createdAt,
      generatedAt,
    }]
  })
}

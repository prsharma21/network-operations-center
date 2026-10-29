import { ApiError, apiGet } from '@/services/httpClient'
import { isRecord, readNumber, readString, unwrapList } from '@/services/jsonParse'
import type {
  AlarmDetail,
  AlarmFacets,
  AlarmListItem,
  AlarmListResult,
  AlarmQuery,
  AlarmSiteContext,
  RelatedIncidentRef,
} from '@/types/alarm'
import type { OperationalStatus, Severity } from '@/types/ui'

export const ALARMS_ENDPOINT = '/alarms'
export const alarmDetailEndpoint = (alarmId: string) => `/alarms/${alarmId}`

function unwrapRows(payload: unknown): unknown[] {
  return unwrapList(payload, 'alarms', 'items', 'results')
}

function normalizeRelated(value: unknown): RelatedIncidentRef | null {
  if (typeof value === 'string' && value.trim()) {
    return { incidentId: value, title: value }
  }
  if (!isRecord(value)) return null
  const incidentId = readString(value, 'incidentId', 'incident_id')
  if (!incidentId) return null
  return { incidentId, title: readString(value, 'title') ?? incidentId }
}

export function normalizeAlarm(value: unknown): AlarmListItem | null {
  if (!isRecord(value)) return null
  const alarmId = readString(value, 'alarmId', 'alarm_id')
  if (!alarmId) return null
  const siteId = readString(value, 'siteId', 'site_id') ?? 'unknown'
  const related = normalizeRelated(value.relatedIncident ?? value.related_incident ?? value.incident_id)
  return {
    alarmId,
    alarmType: readString(value, 'alarmType', 'alarm_type', 'alarm_code', 'code') ?? 'UNKNOWN',
    message: readString(value, 'message') ?? '',
    severity: (readString(value, 'severity') ?? 'info') as Severity,
    siteId,
    siteName: readString(value, 'siteName', 'site_name') ?? siteId,
    region: readString(value, 'region') ?? '—',
    technology: readString(value, 'technology') ?? '—',
    networkComponent: readString(value, 'networkComponent', 'network_component', 'component') ?? '—',
    timestamp: readString(value, 'timestamp') ?? new Date().toISOString(),
    status: (readString(value, 'status') ?? 'open') as OperationalStatus,
    relatedIncident: related,
    correlationKey: readString(value, 'correlationKey', 'correlation_key') ?? null,
    source: readString(value, 'source') ?? null,
    scenarioId: readString(value, 'scenarioId', 'scenario_id') ?? null,
    payload: value,
  }
}

function facetsFromRows(rows: AlarmListItem[]): AlarmFacets {
  const sites = new Map<string, string>()
  for (const row of rows) sites.set(row.siteId, row.siteName)
  return {
    severities: [...new Set(rows.map((item) => item.severity))],
    regions: [...new Set(rows.map((item) => item.region))].sort(),
    technologies: [...new Set(rows.map((item) => item.technology).filter((item) => item !== '—'))].sort(),
    statuses: [...new Set(rows.map((item) => item.status))],
    sites: [...sites.entries()].map(([siteId, siteName]) => ({ siteId, siteName })),
  }
}

function toQueryParams(query: AlarmQuery): Record<string, string> {
  const params: Record<string, string> = {
    sort: query.sort,
    dir: query.dir,
    page: String(query.page),
    page_size: String(query.pageSize),
  }
  if (query.severity) params.severity = query.severity
  if (query.region) params.region = query.region
  if (query.siteId) params.site_id = query.siteId
  if (query.technology) params.technology = query.technology
  if (query.status) params.status = query.status
  if (query.range) params.range = query.range
  if (query.q) params.q = query.q
  return params
}

export async function listAlarms(query: AlarmQuery, signal?: AbortSignal): Promise<AlarmListResult> {
  const payload = await apiGet<unknown>(ALARMS_ENDPOINT, { signal, query: toQueryParams(query) })
  const rows = unwrapRows(payload).map(normalizeAlarm).filter((item): item is AlarmListItem => Boolean(item))
  if (rows.length === 0 && unwrapRows(payload).length > 0) {
    throw new ApiError('FastAPI alarm list payload was not recognized', 502, ALARMS_ENDPOINT)
  }

  const meta = isRecord(payload) ? payload : {}
  const total = readNumber(meta, 'total', 'count', 'total_count')
  const page = readNumber(meta, 'page')
  const pageSize = readNumber(meta, 'pageSize', 'page_size')

  return {
    items: rows,
    total: total ?? rows.length,
    page: page ?? query.page,
    pageSize: pageSize ?? query.pageSize,
    asOf: readString(meta, 'asOf', 'as_of') ?? rows[0]?.timestamp ?? new Date().toISOString(),
    source: 'api',
    filtering: 'server',
    missingEndpoints: [],
    facets: facetsFromRows(rows),
  }
}

export async function getAlarmDetail(
  alarmId: string,
  options: { signal?: AbortSignal } = {},
): Promise<AlarmDetail> {
  const path = alarmDetailEndpoint(alarmId)
  const payload = await apiGet<unknown>(path, { signal: options.signal })
  const alarm = normalizeAlarm(payload)
  if (!alarm) throw new ApiError('FastAPI alarm detail payload was not recognized', 502, path)
  const siteRecord = isRecord(payload) && isRecord(payload.site) ? payload.site : null
  const site: AlarmSiteContext | null = siteRecord
    ? {
        siteId: readString(siteRecord, 'siteId', 'site_id') ?? alarm.siteId,
        siteName: readString(siteRecord, 'siteName', 'site_name') ?? alarm.siteName,
        region: readString(siteRecord, 'region') ?? alarm.region,
        technology: readString(siteRecord, 'technology') ?? alarm.technology,
        vendor: readString(siteRecord, 'vendor') ?? '—',
        siteType: readString(siteRecord, 'siteType', 'site_type') ?? '—',
        status: (readString(siteRecord, 'status') ?? 'healthy') as AlarmSiteContext['status'],
      }
    : {
        siteId: alarm.siteId,
        siteName: alarm.siteName,
        region: alarm.region,
        technology: alarm.technology,
        vendor: '—',
        siteType: '—',
        status: 'healthy',
      }
  return {
    alarm,
    site,
    relatedAlarms: isRecord(payload) && Array.isArray(payload.related_alarms ?? payload.relatedAlarms)
      ? ((payload.related_alarms ?? payload.relatedAlarms) as unknown[])
          .map(normalizeAlarm)
          .filter((item): item is AlarmListItem => Boolean(item))
      : [],
    source: 'api',
    missingEndpoints: [],
  }
}

export function listFilterNotice(result: AlarmListResult): string | null {
  if (result.filtering !== 'client') return null
  return 'The alarm API returned an unpaginated list. Paging, sort, and extra filters were applied in the browser.'
}

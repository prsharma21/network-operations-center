import { ApiError, apiGet, isMissingEndpoint } from '@/services/httpClient'
import { isRecord, readString, readStringArray, unwrapList } from '@/services/jsonParse'
import type {
  RunbookFacets,
  RunbookPassage,
  RunbookSearchQuery,
  RunbookSearchResult,
} from '@/types/runbook'

export const RUNBOOK_SEARCH_ENDPOINT = '/runbooks/search'
export const incidentRunbooksEndpoint = (incidentId: string) => `/incidents/${incidentId}/runbooks`

function unwrapPassages(payload: unknown): unknown[] {
  return unwrapList(payload, 'passages', 'documents', 'results', 'items')
}

function normalizePassage(value: unknown): RunbookPassage | null {
  if (!isRecord(value)) return null
  const documentId = readString(value, 'documentId', 'document_id', 'id', 'reference_id')
  const title = readString(value, 'title')
  const sourceRef = readString(value, 'sourceRef', 'source_ref', 'source', 'uri', 'source_uri')
  if (!documentId || !title || !sourceRef) return null
  const relatedIncidents = Array.isArray(value.relatedIncidents ?? value.related_incidents)
    ? (value.relatedIncidents ?? value.related_incidents) as unknown[]
    : readStringArray(value.related_incident_ids).map((incidentId) => ({ incidentId }))
  const relatedPostmortems = Array.isArray(value.relatedPostmortems ?? value.related_postmortems)
    ? (value.relatedPostmortems ?? value.related_postmortems) as unknown[]
    : []
  return {
    id: readString(value, 'id') ?? documentId,
    documentId,
    title,
    sourceRef,
    excerpt: readString(value, 'excerpt', 'body', 'text', 'description') ?? '',
    technology: readStringArray(value.technology ?? value.technologies),
    alarmTypes: readStringArray(value.alarmTypes ?? value.alarm_types),
    steps: readStringArray(value.steps ?? value.troubleshooting_steps),
    kpis: Array.isArray(value.kpis)
      ? value.kpis.flatMap((item) => {
          if (!isRecord(item)) return []
          const name = readString(item, 'name')
          const definition = readString(item, 'definition')
          const threshold = readString(item, 'threshold')
          if (!name || !definition || !threshold) return []
          return [{ name, definition, threshold }]
        })
      : [],
    relatedIncidents: relatedIncidents.flatMap((item) => {
      if (typeof item === 'string') return [{ incidentId: item }]
      if (!isRecord(item)) return []
      const incidentId = readString(item, 'incidentId', 'incident_id')
      return incidentId ? [{ incidentId }] : []
    }),
    relatedPostmortems: relatedPostmortems.flatMap((item) => {
      if (!isRecord(item)) return []
      const id = readString(item, 'id', 'postmortem_id')
      const pmTitle = readString(item, 'title')
      const pmSource = readString(item, 'sourceRef', 'source_ref')
      if (!id || !pmTitle || !pmSource) return []
      return [{ id, title: pmTitle, sourceRef: pmSource }]
    }),
    metadata: isRecord(value.metadata)
      ? Object.fromEntries(Object.entries(value.metadata).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
      : {},
    score: typeof value.score === 'number' ? value.score : readString(value, 'relevance_score') ? Number(value.relevance_score) : 0,
  }
}

function emptyFacets(): RunbookFacets {
  return { alarmTypes: [], technologies: [], kpis: [], incidentIds: [] }
}

function facetsFromPassages(passages: RunbookPassage[]): RunbookFacets {
  return {
    alarmTypes: [...new Set(passages.flatMap((item) => item.alarmTypes))].sort(),
    technologies: [...new Set(passages.flatMap((item) => item.technology))].sort(),
    kpis: [...new Set(passages.flatMap((item) => item.kpis.map((kpi) => kpi.name)))].sort(),
    incidentIds: [...new Set(passages.flatMap((item) => item.relatedIncidents.map((ref) => ref.incidentId)))].sort(),
  }
}

function toQueryParams(query: RunbookSearchQuery): Record<string, string> {
  const params: Record<string, string> = {}
  if (query.q) params.q = query.q
  if (query.alarmType) params.alarm_type = query.alarmType
  if (query.technology) params.technology = query.technology
  if (query.kpi) params.kpi = query.kpi
  if (query.incidentId) params.incident_id = query.incidentId
  return params
}

function hasSearchInput(query: RunbookSearchQuery): boolean {
  return Boolean(query.q?.trim() || query.alarmType || query.technology || query.kpi || query.incidentId)
}

function emptyResult(query: RunbookSearchQuery, missingEndpoints: string[] = []): RunbookSearchResult {
  return {
    query,
    passages: [],
    terms: query.q?.trim().split(/\s+/).filter(Boolean) ?? [],
    facets: emptyFacets(),
    source: 'api',
    filtering: 'server',
    missingEndpoints,
    asOf: new Date().toISOString(),
  }
}

export async function searchRunbooks(
  query: RunbookSearchQuery,
  options: { signal?: AbortSignal } = {},
): Promise<RunbookSearchResult> {
  if (!hasSearchInput(query)) {
    return emptyResult(query)
  }

  try {
    const payload = await apiGet<unknown>(RUNBOOK_SEARCH_ENDPOINT, {
      signal: options.signal,
      query: toQueryParams(query),
    })
    const passages = unwrapPassages(payload).map(normalizePassage).filter((item): item is RunbookPassage => Boolean(item))
    if (passages.length === 0 && unwrapPassages(payload).length > 0) {
      throw new ApiError('FastAPI runbook payload was not recognized', 502, RUNBOOK_SEARCH_ENDPOINT)
    }
    const meta = isRecord(payload) ? payload : {}
    return {
      query,
      passages,
      terms: query.q?.trim().split(/\s+/).filter(Boolean) ?? [],
      facets: facetsFromPassages(passages),
      source: 'api',
      filtering: 'server',
      missingEndpoints: [],
      asOf: readString(meta, 'asOf', 'as_of') ?? new Date().toISOString(),
    }
  } catch (error) {
    if (isMissingEndpoint(error)) {
      return emptyResult(query, [RUNBOOK_SEARCH_ENDPOINT])
    }
    throw error
  }
}

export async function getIncidentRunbooks(
  incidentId: string,
  _context: { title?: string; alarmTypes?: string[] } = {},
  options: { signal?: AbortSignal } = {},
): Promise<RunbookSearchResult> {
  const path = incidentRunbooksEndpoint(incidentId)
  try {
    const payload = await apiGet<unknown>(path, { signal: options.signal })
    const passages = unwrapPassages(payload).map(normalizePassage).filter((item): item is RunbookPassage => Boolean(item))
    return {
      query: { incidentId },
      passages,
      terms: [],
      facets: emptyFacets(),
      source: 'api',
      filtering: 'server',
      missingEndpoints: [],
      asOf: new Date().toISOString(),
    }
  } catch (error) {
    if (isMissingEndpoint(error)) {
      return emptyResult({ incidentId }, [path])
    }
    throw error
  }
}

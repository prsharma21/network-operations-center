import type {
  RunbookFacets,
  RunbookPassage,
  RunbookSearchQuery,
  RunbookSearchResult,
} from '@/types/runbook'

import catalogFile from '../../../../data/runbooks/runbook_catalog.json'

interface CatalogKpi {
  name: string
  definition: string
  threshold: string
}

interface CatalogDocument {
  document_id: string
  title: string
  source_ref: string
  technology: string[]
  alarm_types: string[]
  kpis: string[]
  related_incident_ids: string[]
  related_scenario_ids: string[]
  related_postmortems: Array<{ id: string; title: string; source_ref: string }>
  body: string
  steps: string[]
  kpi_definitions: CatalogKpi[]
  synthetic?: boolean
}

interface CatalogFile {
  catalog_id: string
  version: string
  synthetic: boolean
  disclaimer: string
  documents: CatalogDocument[]
}

const catalog = catalogFile as CatalogFile
const DOCUMENTS = catalog.documents

function tokenize(value: string | undefined): string[] {
  if (!value) return []
  return value
    .toLowerCase()
    .split(/[^a-z0-9+_]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3)
    .filter((token) => !['the', 'and', 'for', 'from', 'this', 'that', 'with', 'are', 'was', 'were'].includes(token))
}

function excerptAround(body: string, terms: string[]): string {
  if (terms.length === 0) {
    return body.length > 280 ? `${body.slice(0, 277)}…` : body
  }
  const lower = body.toLowerCase()
  let index = -1
  for (const term of terms) {
    const found = lower.indexOf(term.toLowerCase())
    if (found >= 0 && (index < 0 || found < index)) index = found
  }
  if (index < 0) {
    return body.length > 280 ? `${body.slice(0, 277)}…` : body
  }
  const start = Math.max(0, index - 80)
  const end = Math.min(body.length, index + 200)
  const slice = body.slice(start, end)
  return `${start > 0 ? '…' : ''}${slice}${end < body.length ? '…' : ''}`
}

function scoreDocument(doc: CatalogDocument, terms: string[]): number {
  if (terms.length === 0) return 1
  const haystack = [
    doc.title,
    doc.body,
    doc.document_id,
    ...doc.alarm_types,
    ...doc.kpis,
    ...doc.technology,
    ...doc.steps,
    ...doc.related_incident_ids,
  ].join(' ').toLowerCase()
  if (!terms.every((term) => haystack.includes(term))) return 0
  return terms.length
}

function toPassage(doc: CatalogDocument, terms: string[], score: number): RunbookPassage {
  return {
    id: `${doc.document_id}:${score}`,
    documentId: doc.document_id,
    title: doc.title,
    sourceRef: doc.source_ref,
    excerpt: excerptAround(doc.body, terms),
    technology: doc.technology,
    alarmTypes: doc.alarm_types,
    steps: doc.steps,
    kpis: doc.kpi_definitions.map((item) => ({
      name: item.name,
      definition: item.definition,
      threshold: item.threshold,
    })),
    relatedIncidents: doc.related_incident_ids.map((incidentId) => ({ incidentId })),
    relatedPostmortems: (doc.related_postmortems ?? []).map((item) => ({
      id: item.id,
      title: item.title,
      sourceRef: item.source_ref,
    })),
    metadata: {
      catalog: catalog.catalog_id,
      version: catalog.version,
      synthetic: doc.synthetic ? 'true' : 'false',
      scenarios: doc.related_scenario_ids.join(', ') || 'none',
    },
    score,
  }
}

export function demoRunbookFacets(): RunbookFacets {
  return {
    alarmTypes: [...new Set(DOCUMENTS.flatMap((doc) => doc.alarm_types))].sort(),
    technologies: [...new Set(DOCUMENTS.flatMap((doc) => doc.technology))].sort(),
    kpis: [...new Set(DOCUMENTS.flatMap((doc) => doc.kpis))].sort(),
    incidentIds: [...new Set(DOCUMENTS.flatMap((doc) => doc.related_incident_ids))].sort(),
  }
}

export function searchDemoRunbooks(query: RunbookSearchQuery): RunbookSearchResult {
  const terms = tokenize(query.q)
  const filtered = DOCUMENTS.filter((doc) => {
    if (query.alarmType && !doc.alarm_types.includes(query.alarmType)) return false
    if (query.technology && !doc.technology.includes(query.technology)) return false
    if (query.kpi && !doc.kpis.includes(query.kpi)) return false
    if (query.incidentId && !doc.related_incident_ids.includes(query.incidentId)) return false
    return true
  })

  const hasConstraint = Boolean(query.q?.trim() || query.alarmType || query.technology || query.kpi || query.incidentId)
  const ranked = hasConstraint
    ? filtered
        .map((doc) => ({ doc, score: scoreDocument(doc, terms) }))
        .filter((item) => (terms.length === 0 ? item.score > 0 : item.score > 0))
        .sort((left, right) => right.score - left.score || left.doc.title.localeCompare(right.doc.title))
    : []

  return {
    query,
    passages: ranked.map((item) => toPassage(item.doc, terms, item.score)),
    terms,
    facets: demoRunbookFacets(),
    source: 'demo',
    filtering: 'client',
    missingEndpoints: ['/runbooks/search'],
    asOf: '2026-10-20T00:00:00.000Z',
  }
}

export function searchDemoRunbooksForIncident(input: {
  incidentId: string
  title: string
  alarmTypes: string[]
}): RunbookSearchResult {
  const byIncident = searchDemoRunbooks({ incidentId: input.incidentId })
  if (byIncident.passages.length > 0) return byIncident
  for (const alarmType of input.alarmTypes) {
    const byAlarm = searchDemoRunbooks({ alarmType })
    if (byAlarm.passages.length > 0) return byAlarm
  }
  return searchDemoRunbooks({ q: input.title })
}

export interface RunbookKpiRef {
  name: string
  definition: string
  threshold: string
}

export interface RunbookIncidentRef {
  incidentId: string
}

export interface RunbookPostmortemRef {
  id: string
  title: string
  sourceRef: string
}

export interface RunbookPassage {
  id: string
  documentId: string
  title: string
  sourceRef: string
  excerpt: string
  technology: string[]
  alarmTypes: string[]
  steps: string[]
  kpis: RunbookKpiRef[]
  relatedIncidents: RunbookIncidentRef[]
  relatedPostmortems: RunbookPostmortemRef[]
  metadata: Record<string, string>
  score: number
}

export type RunbookRetrievalStatus = 'idle' | 'not_requested' | 'retrieved' | 'empty' | 'failed'

export interface RunbookSearchQuery {
  q?: string
  alarmType?: string
  technology?: string
  kpi?: string
  incidentId?: string
}

export interface RunbookSearchResult {
  query: RunbookSearchQuery
  passages: RunbookPassage[]
  terms: string[]
  facets: RunbookFacets
  source: 'api' | 'demo'
  filtering: 'server' | 'client'
  missingEndpoints: string[]
  asOf: string
}

export interface RunbookFacets {
  alarmTypes: string[]
  technologies: string[]
  kpis: string[]
  incidentIds: string[]
}

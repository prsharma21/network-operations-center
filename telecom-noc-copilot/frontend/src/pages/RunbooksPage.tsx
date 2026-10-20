import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '@/components/common/Button'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorMessage } from '@/components/common/ErrorMessage'
import { LoadingIndicator } from '@/components/common/LoadingIndicator'
import { PageHeader } from '@/components/common/PageHeader'
import { DemoDataBanner } from '@/components/dashboard/DemoDataBanner'
import { RunbookPassageCard } from '@/components/runbooks/RunbookPassageCard'
import { RunbookSearchForm } from '@/components/runbooks/RunbookSearchForm'
import { useRunbookSearch } from '@/hooks/useRunbookSearch'
import { getNavItem } from '@/routes/navigation'
import { demoRunbookFacets } from '@/services/demo/runbookDemo'
import type { RunbookFacets, RunbookSearchQuery } from '@/types/runbook'
import { canUseDemoFallback } from '@/utils/config'

const page = getNavItem('/runbooks')
const EMPTY_FACETS: RunbookFacets = {
  alarmTypes: [],
  technologies: [],
  kpis: [],
  incidentIds: [],
}

function readQuery(params: URLSearchParams): RunbookSearchQuery {
  return {
    q: params.get('q') ?? undefined,
    alarmType: params.get('alarm_type') ?? params.get('alarmType') ?? undefined,
    technology: params.get('technology') ?? undefined,
    kpi: params.get('kpi') ?? undefined,
    incidentId: params.get('incident') ?? params.get('incident_id') ?? undefined,
  }
}

function hasSearchInput(query: RunbookSearchQuery): boolean {
  return Boolean(query.q?.trim() || query.alarmType || query.technology || query.kpi || query.incidentId)
}

function writeQuery(query: RunbookSearchQuery): URLSearchParams {
  const next = new URLSearchParams()
  if (query.q) next.set('q', query.q)
  if (query.alarmType) next.set('alarm_type', query.alarmType)
  if (query.technology) next.set('technology', query.technology)
  if (query.kpi) next.set('kpi', query.kpi)
  if (query.incidentId) next.set('incident', query.incidentId)
  return next
}

export function RunbooksPage() {
  const [params, setParams] = useSearchParams()
  const query = useMemo(() => readQuery(params), [params])
  const enabled = hasSearchInput(query)
  const [draft, setDraft] = useState(query.q ?? '')
  const { data, loading, error, searched, reload } = useRunbookSearch(query, enabled)
  const facets = data?.facets ?? (canUseDemoFallback() ? demoRunbookFacets() : EMPTY_FACETS)

  const updateQuery = useCallback((patch: Partial<RunbookSearchQuery>) => {
    const merged = { ...readQuery(params), ...patch }
    setParams(writeQuery(merged), { replace: true })
  }, [params, setParams])

  const onSubmit = () => {
    updateQuery({ q: draft.trim() || undefined })
  }

  const onClear = () => {
    setDraft('')
    setParams(new URLSearchParams())
  }

  return (
    <div className="page">
      <PageHeader
        title="Runbook guidance"
        description={page.description}
        actions={enabled ? <Button variant="secondary" onClick={reload}>Retry</Button> : null}
      />

      {data?.source === 'demo' ? (
        <DemoDataBanner asOf={data.asOf} missingEndpoints={data.missingEndpoints} />
      ) : null}

      <RunbookSearchForm
        query={query}
        draft={draft}
        facets={facets}
        onDraftChange={setDraft}
        onQueryChange={(patch) => updateQuery({ q: draft.trim() || undefined, ...patch })}
        onSubmit={onSubmit}
        onClear={onClear}
      />

      {data?.source === 'demo' && data.filtering === 'client' && enabled ? (
        <p className="filter-notice">
          Search is applied in the browser against the labeled synthetic runbook catalog. Citations refer only to
          `data/runbooks/runbook_catalog.json`. Amazon Bedrock is not called from this page.
        </p>
      ) : null}

      {!enabled ? (
        <EmptyState
          title="Search troubleshooting documents"
          description="Enter a symptom, alarm type, technology, KPI, or incident ID. Results come from the retrieval API when available. Matching passages are not generated if the index has no document."
        />
      ) : null}

      {enabled && loading ? (
        <div className="dashboard-state">
          <LoadingIndicator label="Searching runbooks" />
        </div>
      ) : null}

      {error ? (
        <ErrorMessage
          title="Runbook search unavailable"
          message={error}
          action={<Button variant="secondary" onClick={reload}>Retry</Button>}
        />
      ) : null}

      {enabled && !loading && !error && searched && (data?.passages.length ?? 0) === 0 ? (
        <EmptyState
          title="No relevant runbook evidence"
          description="Retrieval returned no matching passage for this query. No troubleshooting procedure was generated, and no citation was invented."
          action={<Button variant="secondary" onClick={onClear}>Clear search</Button>}
        />
      ) : null}

      {data && data.passages.length > 0 && !loading ? (
        <div className="runbook-results">
          <p className="muted">{data.passages.length} passage{data.passages.length === 1 ? '' : 's'} from indexed documents.</p>
          {data.passages.map((passage) => (
            <RunbookPassageCard key={passage.id} passage={passage} terms={data.terms} />
          ))}
        </div>
      ) : null}
    </div>
  )
}

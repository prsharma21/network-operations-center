import { Icon } from '@/components/common/Icon'
import type { RunbookFacets, RunbookSearchQuery } from '@/types/runbook'
import { friendlyAlarmLabel, friendlyKpiName } from '@/utils/plainLanguage'

interface RunbookSearchFormProps {
  query: RunbookSearchQuery
  draft: string
  facets: RunbookFacets
  onDraftChange: (value: string) => void
  onQueryChange: (patch: Partial<RunbookSearchQuery>) => void
  onSubmit: () => void
  onClear: () => void
}

export function RunbookSearchForm({
  query,
  draft,
  facets,
  onDraftChange,
  onQueryChange,
  onSubmit,
  onClear,
}: RunbookSearchFormProps) {
  return (
    <form
      className="alarm-filters"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <div className="alarm-filters__search">
        <Icon name="search" size={16} />
        <label className="visually-hidden" htmlFor="runbook-search">
          Search guides
        </label>
        <input
          id="runbook-search"
          type="search"
          value={draft}
          placeholder="Search by problem symptom, alert, or site issue"
          onChange={(event) => onDraftChange(event.target.value)}
        />
      </div>

      <label className="alarm-filters__field">
        <span>Alert type</span>
        <select
          value={query.alarmType ?? ''}
          onChange={(event) => onQueryChange({ alarmType: event.target.value || undefined })}
        >
          <option value="">All</option>
          {facets.alarmTypes.map((value) => (
            <option key={value} value={value}>{friendlyAlarmLabel(value)}</option>
          ))}
        </select>
      </label>

      <label className="alarm-filters__field">
        <span>Network type</span>
        <select
          value={query.technology ?? ''}
          onChange={(event) => onQueryChange({ technology: event.target.value || undefined })}
        >
          <option value="">All</option>
          {facets.technologies.map((value) => (
            <option key={value} value={value}>{value}</option>
          ))}
        </select>
      </label>

      <label className="alarm-filters__field">
        <span>Health number</span>
        <select
          value={query.kpi ?? ''}
          onChange={(event) => onQueryChange({ kpi: event.target.value || undefined })}
        >
          <option value="">All</option>
          {facets.kpis.map((value) => (
            <option key={value} value={value}>{friendlyKpiName(value)}</option>
          ))}
        </select>
      </label>

      <label className="alarm-filters__field">
        <span>Related problem</span>
        <select
          value={query.incidentId ?? ''}
          onChange={(event) => onQueryChange({ incidentId: event.target.value || undefined })}
        >
          <option value="">All</option>
          {facets.incidentIds.map((value) => (
            <option key={value} value={value}>{value}</option>
          ))}
        </select>
      </label>

      <button type="submit" className="btn btn--primary">Search</button>
      <button type="button" className="btn btn--secondary" onClick={onClear}>Clear</button>
    </form>
  )
}

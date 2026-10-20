import { Icon } from '@/components/common/Icon'
import { TimeRangeFilter } from '@/components/dashboard/TimeRangeFilter'
import type { AlarmFacets, AlarmQuery } from '@/types/alarm'
import type { TimeRange } from '@/types/dashboard'

interface AlarmFiltersProps {
  query: AlarmQuery
  facets: AlarmFacets
  search: string
  onSearchChange: (value: string) => void
  onQueryChange: (patch: Partial<AlarmQuery>) => void
  onClear: () => void
}

export function AlarmFilters({
  query,
  facets,
  search,
  onSearchChange,
  onQueryChange,
  onClear,
}: AlarmFiltersProps) {
  return (
    <div className="alarm-filters">
      <div className="alarm-filters__search">
        <Icon name="search" size={16} />
        <label className="visually-hidden" htmlFor="alarm-search">Search alarms</label>
        <input
          id="alarm-search"
          type="search"
          value={search}
          placeholder="Search ID, type, site, message…"
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>

      <label className="alarm-filters__field">
        <span>Severity</span>
        <select
          value={query.severity ?? ''}
          onChange={(event) => onQueryChange({ severity: event.target.value || undefined, page: 1 })}
        >
          <option value="">All</option>
          {facets.severities.map((value) => (
            <option key={value} value={value}>{value}</option>
          ))}
        </select>
      </label>

      <label className="alarm-filters__field">
        <span>Region</span>
        <select
          value={query.region ?? ''}
          onChange={(event) => onQueryChange({ region: event.target.value || undefined, page: 1 })}
        >
          <option value="">All</option>
          {facets.regions.map((value) => (
            <option key={value} value={value}>{value}</option>
          ))}
        </select>
      </label>

      <label className="alarm-filters__field">
        <span>Site ID</span>
        <select
          value={query.siteId ?? ''}
          onChange={(event) => onQueryChange({ siteId: event.target.value || undefined, page: 1 })}
        >
          <option value="">All</option>
          {facets.sites.map((site) => (
            <option key={site.siteId} value={site.siteId}>{site.siteId} · {site.siteName}</option>
          ))}
        </select>
      </label>

      <label className="alarm-filters__field">
        <span>Technology</span>
        <select
          value={query.technology ?? ''}
          onChange={(event) => onQueryChange({ technology: event.target.value || undefined, page: 1 })}
        >
          <option value="">All</option>
          {facets.technologies.map((value) => (
            <option key={value} value={value}>{value}</option>
          ))}
        </select>
      </label>

      <label className="alarm-filters__field">
        <span>Status</span>
        <select
          value={query.status ?? ''}
          onChange={(event) => onQueryChange({ status: event.target.value || undefined, page: 1 })}
        >
          <option value="">All</option>
          {facets.statuses.map((value) => (
            <option key={value} value={value}>{value}</option>
          ))}
        </select>
      </label>

      <div className="alarm-filters__range">
        <span>Time range</span>
        <TimeRangeFilter
          value={query.range ?? '7d'}
          onChange={(range: TimeRange) => onQueryChange({ range, page: 1 })}
        />
      </div>

      <button type="button" className="btn btn--secondary" onClick={onClear}>
        Clear filters
      </button>
    </div>
  )
}

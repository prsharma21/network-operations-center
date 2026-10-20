import { Icon } from '@/components/common/Icon'
import { StatusBadge } from '@/components/common/StatusBadge'
import type { SiteCatalogItem } from '@/types/site'

interface SiteSelectorProps {
  sites: SiteCatalogItem[]
  selectedId: string | null
  query: string
  onQueryChange: (value: string) => void
  onSelect: (siteId: string) => void
}

export function SiteSelector({ sites, selectedId, query, onQueryChange, onSelect }: SiteSelectorProps) {
  return (
    <section className="site-selector" aria-label="Site selector">
      <div className="site-selector__search">
        <label className="visually-hidden" htmlFor="site-search">
          Search sites
        </label>
        <Icon name="search" size={16} />
        <input
          id="site-search"
          type="search"
          value={query}
          placeholder="Search ID, name, region, vendor"
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </div>
      {sites.length === 0 ? (
        <p className="site-selector__empty">No sites match that search.</p>
      ) : (
        <ul className="site-selector__list" role="listbox" aria-label="Sites">
          {sites.map((site) => {
            const selected = site.siteId === selectedId
            return (
              <li key={site.siteId}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={`site-selector__item${selected ? ' is-selected' : ''}`}
                  onClick={() => onSelect(site.siteId)}
                >
                  <span className="site-selector__id">{site.siteId}</span>
                  <span className="site-selector__name">{site.siteName}</span>
                  <span className="site-selector__meta">
                    {site.region} · {site.technology}
                  </span>
                  <StatusBadge status={site.status} />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

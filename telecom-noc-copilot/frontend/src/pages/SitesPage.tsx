import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/common/Button'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorMessage } from '@/components/common/ErrorMessage'
import { LoadingIndicator } from '@/components/common/LoadingIndicator'
import { PageHeader } from '@/components/common/PageHeader'
import { RecentIncidentsTable } from '@/components/dashboard/RecentIncidentsTable'
import { TimeRangeFilter } from '@/components/dashboard/TimeRangeFilter'
import { TrendCharts } from '@/components/dashboard/TrendCharts'
import { SiteAlarmsTable } from '@/components/sites/SiteAlarmsTable'
import { SiteDeployments } from '@/components/sites/SiteDeployments'
import { SiteEquipmentList } from '@/components/sites/SiteEquipmentList'
import { SiteKpiTiles } from '@/components/sites/SiteKpiTiles'
import { SiteOverview } from '@/components/sites/SiteOverview'
import { SiteSelector } from '@/components/sites/SiteSelector'
import { SiteTopology } from '@/components/sites/SiteTopology'
import { useSiteCatalog } from '@/hooks/useSiteCatalog'
import { useSiteHealth } from '@/hooks/useSiteHealth'
import { getNavItem } from '@/routes/navigation'
import { isTimeRange, type TimeRange } from '@/types/dashboard'

const page = getNavItem('/sites')

function readRange(value: string | null): TimeRange {
  return isTimeRange(value) ? value : '7d'
}

export function SitesPage() {
  const { siteId: routeSiteId } = useParams()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const range = readRange(params.get('range'))
  const statusFilter = params.get('status')
  const [query, setQuery] = useState('')
  const { sites, loading: catalogLoading, error: catalogError, reload: reloadCatalog } = useSiteCatalog()

  const filteredSites = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return sites.filter((site) => {
      if (statusFilter === 'impacted' && !site.impacted) return false
      if (!needle) return true
      const haystack = `${site.siteId} ${site.siteName} ${site.region} ${site.vendor} ${site.technology}`.toLowerCase()
      return haystack.includes(needle)
    })
  }, [query, sites, statusFilter])

  const selectedId = routeSiteId ?? params.get('site') ?? filteredSites[0]?.siteId ?? null
  const { data, loading, error, reload } = useSiteHealth(selectedId, range)

  useEffect(() => {
    if (routeSiteId || params.get('site') || !selectedId) return
    const next = new URLSearchParams(params)
    navigate({ pathname: `/sites/${selectedId}`, search: next.toString() }, { replace: true })
  }, [navigate, params, routeSiteId, selectedId])

  const onSelect = (siteId: string) => {
    const next = new URLSearchParams(params)
    next.delete('site')
    navigate({ pathname: `/sites/${siteId}`, search: next.toString() })
  }

  const onRangeChange = (nextRange: TimeRange) => {
    const next = new URLSearchParams(params)
    next.set('range', nextRange)
    setParams(next, { replace: true })
  }

  return (
    <div className="page">
      <PageHeader
        title="Site Health"
        description={page.description}
        actions={<TimeRangeFilter value={range} onChange={onRangeChange} />}
      />

      {catalogError ? (
        <ErrorMessage
          title="Site catalog unavailable"
          message={catalogError}
          action={<Button variant="secondary" onClick={reloadCatalog}>Retry</Button>}
        />
      ) : null}

      {catalogLoading ? (
        <div className="dashboard-state">
          <LoadingIndicator label="Loading sites" />
        </div>
      ) : null}

      {!catalogLoading && !catalogError ? (
        <div className="site-health">
          <SiteSelector
            sites={filteredSites}
            selectedId={selectedId}
            query={query}
            onQueryChange={setQuery}
            onSelect={onSelect}
          />

          <div className="site-health__detail">
            {loading ? (
              <div className="dashboard-state">
                <LoadingIndicator label="Loading site health" />
              </div>
            ) : null}

            {error ? (
              <ErrorMessage
                title="Site health unavailable"
                message={error}
                action={<Button variant="secondary" onClick={reload}>Retry</Button>}
              />
            ) : null}

            {!selectedId && !loading ? (
              <EmptyState
                title="Select a site"
                description="Choose a site from the list to inspect health, alarms, deployments, and topology."
              />
            ) : null}

            {data && !loading ? (
              <>
                <SiteOverview site={data} />
                <SiteKpiTiles kpis={data.kpis} />
                <section className="dashboard-section" aria-label="Site KPI trends">
                  <h3 className="dashboard-section__title">KPI trends</h3>
                  <TrendCharts range={range} points={data.trends} />
                </section>
                <SiteEquipmentList equipment={data.equipment} />
                <div className="dashboard-split dashboard-split--wide">
                  <SiteAlarmsTable siteId={data.siteId} alarms={data.activeAlarms} />
                  <SiteDeployments deployments={data.deployments} />
                </div>
                <SiteTopology topology={data.topology} />
                <RecentIncidentsTable
                  incidents={data.incidents}
                  title="Related incidents"
                  emptyDescription="No incidents are linked to this site."
                />
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '@/components/common/Button'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorMessage } from '@/components/common/ErrorMessage'
import { LoadingIndicator } from '@/components/common/LoadingIndicator'
import { PageHeader } from '@/components/common/PageHeader'
import { DemoDataBanner } from '@/components/dashboard/DemoDataBanner'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { RecentEventsList } from '@/components/dashboard/RecentEventsList'
import { RecentIncidentsTable } from '@/components/dashboard/RecentIncidentsTable'
import { RegionalHealthTable } from '@/components/dashboard/RegionalHealthTable'
import { SeverityDistribution } from '@/components/dashboard/SeverityDistribution'
import { TimeRangeFilter } from '@/components/dashboard/TimeRangeFilter'
import { TrendCharts } from '@/components/dashboard/TrendCharts'
import { useDashboardSummary } from '@/hooks/useDashboardSummary'
import { getNavItem } from '@/routes/navigation'
import { isTimeRange, type TimeRange } from '@/types/dashboard'
import { formatLatency, formatNumber } from '@/utils/format'

const page = getNavItem('/')

function readRange(value: string | null): TimeRange {
  return isTimeRange(value) ? value : '7d'
}

export function DashboardPage() {
  const [params, setParams] = useSearchParams()
  const range = readRange(params.get('range'))
  const { data, loading, error, reload } = useDashboardSummary(range)

  const query = useMemo(() => `range=${range}`, [range])

  const onRangeChange = (next: TimeRange) => {
    const nextParams = new URLSearchParams(params)
    nextParams.set('range', next)
    setParams(nextParams, { replace: true })
  }

  const hasNoData = Boolean(
    data
    && data.kpis.activeAlarms === 0
    && data.kpis.openIncidents === 0
    && data.trends.length === 0
    && data.recentIncidents.length === 0
    && data.recentEvents.length === 0,
  )

  return (
    <div className="page">
      <PageHeader
        title="Network Health Dashboard"
        description={page.description}
        actions={<TimeRangeFilter value={range} onChange={onRangeChange} />}
      />

      {loading ? (
        <div className="dashboard-state">
          <LoadingIndicator label="Loading network health" />
        </div>
      ) : null}

      {error ? (
        <ErrorMessage
          title="Dashboard unavailable"
          message={error}
          action={<Button variant="secondary" onClick={reload}>Retry</Button>}
        />
      ) : null}

      {data && !loading ? (
        <>
          {data.source === 'demo' ? (
            <DemoDataBanner asOf={data.asOf} missingEndpoint={data.missingEndpoint} />
          ) : null}

          <section className="kpi-grid" aria-label="Network health indicators">
            <KpiCard
              label="Active Alarms"
              value={formatNumber(data.kpis.activeAlarms)}
              hint="Open and acknowledged"
              to={`/alarms?status=active&${query}`}
            />
            <KpiCard
              label="Critical Alarms"
              value={formatNumber(data.kpis.criticalAlarms)}
              hint="Not cleared"
              to={`/alarms?severity=critical&${query}`}
              tone={data.kpis.criticalAlarms > 0 ? 'critical' : 'default'}
            />
            <KpiCard
              label="Impacted Sites"
              value={formatNumber(data.kpis.impactedSites)}
              hint="Degraded or alarming"
              to={`/sites?status=impacted&${query}`}
            />
            <KpiCard
              label="Open Incidents"
              value={formatNumber(data.kpis.openIncidents)}
              hint="Requires operator attention"
              to={`/incidents?status=open&${query}`}
            />
            <KpiCard
              label="Average Network Latency"
              value={formatLatency(data.kpis.averageLatencyMs)}
              hint="Reachable sites in range"
              to={`/?${query}#network-trends`}
            />
          </section>

          {hasNoData ? (
            <EmptyState
              title="No data for this time range"
              description="No alarms, incidents, or telemetry are available in the selected window. Try Last 7 Days."
            />
          ) : (
            <>
              <section id="network-trends" className="dashboard-section" aria-label="Network trends">
                <h3 className="dashboard-section__title">Network trends</h3>
                <TrendCharts range={range} points={data.trends} />
              </section>

              <div className="dashboard-split">
                <SeverityDistribution items={data.severityDistribution} />
                <RegionalHealthTable rows={data.regionalHealth} />
              </div>

              <div className="dashboard-split dashboard-split--wide">
                <RecentIncidentsTable incidents={data.recentIncidents} />
                <RecentEventsList events={data.recentEvents} />
              </div>
            </>
          )}
        </>
      ) : null}
    </div>
  )
}

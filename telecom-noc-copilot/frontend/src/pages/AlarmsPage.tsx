import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlarmBulkBar } from '@/components/alarms/AlarmBulkBar'
import { AlarmDetailDrawer } from '@/components/alarms/AlarmDetailDrawer'
import { AlarmFilters } from '@/components/alarms/AlarmFilters'
import { AlarmTable } from '@/components/alarms/AlarmTable'
import { Button } from '@/components/common/Button'
import { Card } from '@/components/common/Card'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorMessage } from '@/components/common/ErrorMessage'
import { LoadingIndicator } from '@/components/common/LoadingIndicator'
import { PageHeader } from '@/components/common/PageHeader'
import { useAlarmDetail, useAlarms } from '@/hooks/useAlarms'
import { listFilterNotice } from '@/services/alarmService'
import { getNavItem } from '@/routes/navigation'
import {
  ALARM_PAGE_SIZE,
  isAlarmSortKey,
  type AlarmListItem,
  type AlarmQuery,
  type AlarmSortKey,
} from '@/types/alarm'
import { isTimeRange } from '@/types/dashboard'

const page = getNavItem('/alarms')

function readQuery(params: URLSearchParams): AlarmQuery {
  const sortParam = params.get('sort')
  const dir = params.get('dir') === 'asc' ? 'asc' : 'desc'
  const pageNumber = Number.parseInt(params.get('page') ?? '1', 10)
  return {
    severity: params.get('severity') ?? undefined,
    region: params.get('region') ?? undefined,
    siteId: params.get('site') ?? params.get('site_id') ?? undefined,
    technology: params.get('technology') ?? undefined,
    status: params.get('status') ?? undefined,
    range: isTimeRange(params.get('range')) ? params.get('range') as AlarmQuery['range'] : '7d',
    q: params.get('q') ?? undefined,
    sort: isAlarmSortKey(sortParam) ? sortParam : 'timestamp',
    dir,
    page: Number.isFinite(pageNumber) && pageNumber > 0 ? pageNumber : 1,
    pageSize: ALARM_PAGE_SIZE,
  }
}

function writeQuery(query: AlarmQuery, alarmId: string | null): URLSearchParams {
  const next = new URLSearchParams()
  if (query.severity) next.set('severity', query.severity)
  if (query.region) next.set('region', query.region)
  if (query.siteId) next.set('site', query.siteId)
  if (query.technology) next.set('technology', query.technology)
  if (query.status) next.set('status', query.status)
  if (query.range) next.set('range', query.range)
  if (query.q) next.set('q', query.q)
  if (query.sort !== 'timestamp') next.set('sort', query.sort)
  if (query.dir !== 'desc') next.set('dir', query.dir)
  if (query.page > 1) next.set('page', String(query.page))
  if (alarmId) next.set('alarm', alarmId)
  return next
}

export function AlarmsPage() {
  const [params, setParams] = useSearchParams()
  const query = useMemo(() => readQuery(params), [params])
  const selectedAlarmId = params.get('alarm')
  const [search, setSearch] = useState(query.q ?? '')
  const [selected, setSelected] = useState<Map<string, AlarmListItem>>(new Map())
  const [grouping, setGrouping] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const { data, loading, error, reload } = useAlarms(query)
  const { detail, loading: detailLoading, error: detailError } = useAlarmDetail(selectedAlarmId)

  const updateQuery = useCallback((patch: Partial<AlarmQuery>, alarmId: string | null = selectedAlarmId) => {
    const merged = { ...readQuery(params), ...patch }
    setParams(writeQuery(merged, alarmId), { replace: true })
  }, [params, selectedAlarmId, setParams])

  useEffect(() => {
    setSearch(query.q ?? '')
  }, [query.q])

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const nextQuery = search.trim()
      if ((query.q ?? '') === nextQuery) return
      updateQuery({ q: nextQuery || undefined, page: 1 })
    }, 300)
    return () => window.clearTimeout(handle)
  }, [search, query.q, updateQuery])

  const onSort = (key: AlarmSortKey) => {
    if (query.sort === key) {
      updateQuery({ dir: query.dir === 'asc' ? 'desc' : 'asc', page: 1 })
      return
    }
    updateQuery({ sort: key, dir: key === 'timestamp' || key === 'severity' ? 'desc' : 'asc', page: 1 })
  }

  const onClearFilters = () => {
    setSearch('')
    setParams(writeQuery({
      range: '7d',
      sort: 'timestamp',
      dir: 'desc',
      page: 1,
      pageSize: ALARM_PAGE_SIZE,
    }, selectedAlarmId))
  }

  const onToggle = (item: AlarmListItem) => {
    setSelected((current) => {
      const next = new Map(current)
      if (next.has(item.alarmId)) next.delete(item.alarmId)
      else next.set(item.alarmId, item)
      return next
    })
  }

  const onTogglePage = (checked: boolean) => {
    setSelected((current) => {
      const next = new Map(current)
      for (const item of data?.items ?? []) {
        if (checked) next.set(item.alarmId, item)
        else next.delete(item.alarmId)
      }
      return next
    })
  }

  const onCopy = async () => {
    const ids = [...selected.keys()].join(', ')
    try {
      await navigator.clipboard.writeText(ids)
      setNotice(`Copied ${selected.size} alarm ID${selected.size === 1 ? '' : 's'}. No network change was made.`)
    } catch {
      setNotice('Clipboard is unavailable in this browser.')
    }
  }

  const selectedItems = [...selected.values()]
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / query.pageSize))
  const filterNotice = data ? listFilterNotice(data) : null
  const emptyDescription = query.q || query.severity || query.region || query.siteId || query.technology || query.status
    ? 'No alarms match the current filters. Clear filters or widen the time range.'
    : 'GET /alarms returned no records for this time range. Try Last 7 Days.'

  return (
    <div className="page">
      <PageHeader
        title="Alarms"
        description={page.description}
        actions={<Button variant="secondary" onClick={reload}>Refresh</Button>}
      />

      {loading && !data ? (
        <div className="dashboard-state">
          <LoadingIndicator label="Loading alarms" />
        </div>
      ) : null}

      {error ? (
        <ErrorMessage
          title="Alarms unavailable"
          message={error}
          action={<Button variant="secondary" onClick={reload}>Retry</Button>}
        />
      ) : null}

      {data && !error ? (
        <>
          <AlarmFilters
            query={query}
            facets={data.facets}
            search={search}
            onSearchChange={setSearch}
            onQueryChange={(patch) => updateQuery(patch)}
            onClear={onClearFilters}
          />

          {filterNotice ? <p className="filter-notice">{filterNotice}</p> : null}

          <AlarmBulkBar
            selected={selectedItems}
            grouping={grouping}
            notice={notice}
            onCopy={() => void onCopy()}
            onGroup={() => setGrouping((current) => !current)}
            onClear={() => {
              setSelected(new Map())
              setGrouping(false)
              setNotice(null)
            }}
          />

          <Card
            title={`Alarm console (${data.total})`}
            className="card--table"
          >
            {data.items.length === 0 ? (
              <EmptyState
                title="No alarms"
                description={emptyDescription}
                action={<Button variant="secondary" onClick={onClearFilters}>Clear filters</Button>}
              />
            ) : (
              <>
                <AlarmTable
                  items={data.items}
                  selectedIds={selected}
                  selectedAlarmId={selectedAlarmId}
                  sort={query.sort}
                  dir={query.dir}
                  onSort={onSort}
                  onToggle={onToggle}
                  onTogglePage={onTogglePage}
                  onOpen={(alarmId) => updateQuery({}, alarmId)}
                />
                <div className="pagination">
                  <p className="muted">
                    Page {data.page} of {totalPages}
                    {loading ? ' · Refreshing…' : ''}
                  </p>
                  <div className="pagination__buttons">
                    <Button
                      variant="secondary"
                      disabled={data.page <= 1}
                      onClick={() => updateQuery({ page: data.page - 1 })}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={data.page >= totalPages}
                      onClick={() => updateQuery({ page: data.page + 1 })}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </>
            )}
          </Card>
        </>
      ) : null}

      <AlarmDetailDrawer
        open={Boolean(selectedAlarmId)}
        loading={detailLoading}
        error={detailError}
        detail={detail}
        onClose={() => updateQuery({}, null)}
        onOpenRelated={(alarmId) => updateQuery({}, alarmId)}
      />
    </div>
  )
}

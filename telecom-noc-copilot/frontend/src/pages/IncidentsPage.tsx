import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/common/Button'
import { Card } from '@/components/common/Card'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorMessage } from '@/components/common/ErrorMessage'
import { LoadingIndicator } from '@/components/common/LoadingIndicator'
import { PageHeader } from '@/components/common/PageHeader'
import { SeverityBadge } from '@/components/common/SeverityBadge'
import { StatusBadge } from '@/components/common/StatusBadge'
import { useIncidents } from '@/hooks/useIncidents'
import { getNavItem } from '@/routes/navigation'
import { investigationStatusLabel, investigationStatusTone } from '@/types/incident'
import { formatDateTime } from '@/utils/format'

const page = getNavItem('/incidents')

export function IncidentsPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const status = params.get('status') ?? undefined
  const siteId = params.get('site') ?? undefined
  const { items, loading, error, reload } = useIncidents({ status, siteId })

  return (
    <div className="page">
      <PageHeader
        title="Incidents"
        description={page.description}
      />

      {loading ? (
        <div className="dashboard-state">
          <LoadingIndicator label="Loading incidents" />
        </div>
      ) : null}

      {error ? (
        <ErrorMessage
          title="Incidents unavailable"
          message={error}
          action={<Button variant="secondary" onClick={reload}>Retry</Button>}
        />
      ) : null}

      {!loading && !error ? (
        <>
          <Card title={status === 'open' ? 'Open incidents' : 'Incident catalog'} className="card--table">
            {items.length === 0 ? (
              <EmptyState
                title="No incidents"
                description={status === 'open' ? 'There are no open incidents in this filter.' : 'GET /incidents returned no records.'}
              />
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Incident</th>
                      <th scope="col">Site</th>
                      <th scope="col">Severity</th>
                      <th scope="col">Priority</th>
                      <th scope="col">Status</th>
                      <th scope="col">Investigation</th>
                      <th scope="col">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr
                        key={item.incidentId}
                        className="data-table__row--clickable"
                        tabIndex={0}
                        aria-label={`Open incident ${item.incidentId}`}
                        onClick={() => navigate(`/incidents/${item.incidentId}`)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            navigate(`/incidents/${item.incidentId}`)
                          }
                        }}
                      >
                        <td>
                          <Link className="table-link" to={`/incidents/${item.incidentId}`} onClick={(event) => event.stopPropagation()}>
                            {item.incidentId}
                          </Link>
                          <div className="muted">{item.title}</div>
                        </td>
                        <td>
                          <Link to={`/sites/${item.siteId}`} onClick={(event) => event.stopPropagation()}>{item.siteId}</Link>
                          <div className="muted">{item.siteName}</div>
                        </td>
                        <td><SeverityBadge severity={item.severity} /></td>
                        <td>{item.priority}</td>
                        <td><StatusBadge status={item.status} /></td>
                        <td>
                          <StatusBadge
                            status={investigationStatusTone(item.investigationStatus)}
                            label={investigationStatusLabel(item.investigationStatus)}
                          />
                        </td>
                        <td>{formatDateTime(item.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      ) : null}
    </div>
  )
}

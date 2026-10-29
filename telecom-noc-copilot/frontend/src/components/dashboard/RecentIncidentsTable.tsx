import { useNavigate } from 'react-router-dom'
import { Card } from '@/components/common/Card'
import { EmptyState } from '@/components/common/EmptyState'
import { SeverityBadge } from '@/components/common/SeverityBadge'
import { StatusBadge } from '@/components/common/StatusBadge'
import type { RecentIncident } from '@/types/dashboard'
import { formatDateTime } from '@/utils/format'

interface RecentIncidentsTableProps {
  incidents: RecentIncident[]
  title?: string
  emptyDescription?: string
}

export function RecentIncidentsTable({
  incidents = [],
  title = 'Recent incidents',
  emptyDescription = 'No incidents were updated in this time range.',
}: RecentIncidentsTableProps) {
  const navigate = useNavigate()

  return (
    <Card title={title} className="card--table">
      {incidents.length === 0 ? (
        <EmptyState compact title="No incidents" description={emptyDescription} />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Incident ID</th>
                <th scope="col">Title</th>
                <th scope="col">Affected site</th>
                <th scope="col">Severity</th>
                <th scope="col">Status</th>
                <th scope="col">Last updated</th>
              </tr>
            </thead>
            <tbody>
              {incidents.map((incident) => (
                <tr
                  key={incident.incidentId}
                  className="data-table__row--clickable"
                  tabIndex={0}
                  aria-label={`Open incident ${incident.incidentId}`}
                  onClick={() => navigate(`/incidents/${incident.incidentId}`)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      navigate(`/incidents/${incident.incidentId}`)
                    }
                  }}
                >
                  <td>
                    <span className="table-link">{incident.incidentId}</span>
                  </td>
                  <td>{incident.title}</td>
                  <td>{incident.siteName}</td>
                  <td>
                    <SeverityBadge severity={incident.severity} />
                  </td>
                  <td>
                    <StatusBadge status={incident.status} />
                  </td>
                  <td>{formatDateTime(incident.lastUpdated)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

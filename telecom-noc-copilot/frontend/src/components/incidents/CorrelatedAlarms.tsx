import { Link } from 'react-router-dom'
import { Card } from '@/components/common/Card'
import { EmptyState } from '@/components/common/EmptyState'
import { SeverityBadge } from '@/components/common/SeverityBadge'
import { StatusBadge } from '@/components/common/StatusBadge'
import type { CorrelatedAlarm } from '@/types/incident'
import { formatDateTime } from '@/utils/format'

interface CorrelatedAlarmsProps {
  alarms: CorrelatedAlarm[]
}

export function CorrelatedAlarms({ alarms = [] }: CorrelatedAlarmsProps) {
  return (
    <Card title="Correlated alarms" className="card--table">
      {alarms.length === 0 ? (
        <EmptyState compact title="No correlated alarms" description="This incident has no linked alarm IDs." />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Alarm ID</th>
                <th scope="col">Type</th>
                <th scope="col">Site</th>
                <th scope="col">Severity</th>
                <th scope="col">Status</th>
                <th scope="col">Raised</th>
              </tr>
            </thead>
            <tbody>
              {alarms.map((alarm) => (
                <tr key={alarm.alarmId}>
                  <td>
                    <Link className="table-link" to={`/alarms?site=${alarm.siteId}&alarm=${alarm.alarmId}`}>
                      {alarm.alarmId}
                    </Link>
                  </td>
                  <td>
                    <div>{alarm.alarmType}</div>
                    <div className="muted">{alarm.message}</div>
                  </td>
                  <td>
                    <Link to={`/sites/${alarm.siteId}`}>{alarm.siteId}</Link>
                  </td>
                  <td><SeverityBadge severity={alarm.severity} /></td>
                  <td><StatusBadge status={alarm.status} /></td>
                  <td>{formatDateTime(alarm.timestamp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

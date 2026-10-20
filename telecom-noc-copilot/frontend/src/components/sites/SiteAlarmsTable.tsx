import { Link } from 'react-router-dom'
import { Card } from '@/components/common/Card'
import { EmptyState } from '@/components/common/EmptyState'
import { SeverityBadge } from '@/components/common/SeverityBadge'
import { StatusBadge } from '@/components/common/StatusBadge'
import type { SiteAlarmRow } from '@/types/site'
import { formatDateTime } from '@/utils/format'

interface SiteAlarmsTableProps {
  siteId: string
  alarms: SiteAlarmRow[]
}

export function SiteAlarmsTable({ siteId, alarms }: SiteAlarmsTableProps) {
  return (
    <Card title="Active alarms" className="card--table">
      {alarms.length === 0 ? (
        <EmptyState compact title="No active alarms" description="This site has no open or acknowledged alarms." />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Alarm ID</th>
                <th scope="col">Code</th>
                <th scope="col">Message</th>
                <th scope="col">Severity</th>
                <th scope="col">Status</th>
                <th scope="col">Raised</th>
              </tr>
            </thead>
            <tbody>
              {alarms.map((alarm) => (
                <tr key={alarm.alarmId}>
                  <td>
                    <Link className="table-link" to={`/alarms?site=${siteId}&alarm=${alarm.alarmId}`}>
                      {alarm.alarmId}
                    </Link>
                  </td>
                  <td>{alarm.code}</td>
                  <td>{alarm.message}</td>
                  <td>
                    <SeverityBadge severity={alarm.severity} />
                  </td>
                  <td>
                    <StatusBadge status={alarm.status} />
                  </td>
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

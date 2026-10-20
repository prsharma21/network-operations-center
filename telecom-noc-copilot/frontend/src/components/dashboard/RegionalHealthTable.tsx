import { Card } from '@/components/common/Card'
import { EmptyState } from '@/components/common/EmptyState'
import { StatusBadge } from '@/components/common/StatusBadge'
import type { RegionalHealthRow } from '@/types/dashboard'
import { formatNumber } from '@/utils/format'

interface RegionalHealthTableProps {
  rows: RegionalHealthRow[]
}

export function RegionalHealthTable({ rows }: RegionalHealthTableProps) {
  return (
    <Card title="Regional health" className="card--table">
      {rows.length === 0 ? (
        <EmptyState compact title="No regional data" description="Site inventory is empty for this view." />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Region</th>
                <th scope="col">Total sites</th>
                <th scope="col">Affected sites</th>
                <th scope="col">Active alarms</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.region}>
                  <td>{row.region}</td>
                  <td>{formatNumber(row.totalSites)}</td>
                  <td>{formatNumber(row.affectedSites)}</td>
                  <td>{formatNumber(row.activeAlarms)}</td>
                  <td>
                    <StatusBadge status={row.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

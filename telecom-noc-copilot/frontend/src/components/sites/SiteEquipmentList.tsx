import { Card } from '@/components/common/Card'
import { EmptyState } from '@/components/common/EmptyState'
import { StatusBadge } from '@/components/common/StatusBadge'
import type { SiteEquipment } from '@/types/site'

interface SiteEquipmentListProps {
  equipment: SiteEquipment[]
}

export function SiteEquipmentList({ equipment }: SiteEquipmentListProps) {
  return (
    <Card title="Equipment" className="card--table">
      {equipment.length === 0 ? (
        <EmptyState compact title="No equipment records" description="OSS inventory has no components for this site." />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Equipment ID</th>
                <th scope="col">Component</th>
                <th scope="col">Vendor</th>
                <th scope="col">Software</th>
                <th scope="col">State</th>
              </tr>
            </thead>
            <tbody>
              {equipment.map((item) => (
                <tr key={`${item.equipmentId}-${item.component}`}>
                  <td>{item.equipmentId}</td>
                  <td>{item.component}</td>
                  <td>{item.vendor}</td>
                  <td>{item.softwareVersion}</td>
                  <td>
                    <StatusBadge status={item.operationalState} />
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

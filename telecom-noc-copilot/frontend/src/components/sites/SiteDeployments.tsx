import { Card } from '@/components/common/Card'
import { EmptyState } from '@/components/common/EmptyState'
import { StatusBadge } from '@/components/common/StatusBadge'
import type { SiteDeploymentRow } from '@/types/site'
import { formatDateTime } from '@/utils/format'

interface SiteDeploymentsProps {
  deployments: SiteDeploymentRow[]
}

export function SiteDeployments({ deployments = [] }: SiteDeploymentsProps) {
  return (
    <Card title="Recent deployments">
      {deployments.length === 0 ? (
        <EmptyState compact title="No deployments" description="No configuration or software changes are recorded for this site." />
      ) : (
        <ol className="event-list">
          {deployments.map((item) => (
            <li key={item.deploymentId} className="event-list__item">
              <div className="event-list__body">
                <div className="event-list__headline">
                  <strong>{item.deploymentId}</strong>
                  <span className="event-list__kind">{item.changeType}</span>
                  <StatusBadge status="maintenance" label={item.statusLabel} />
                </div>
                <p className="event-list__title">
                  {item.versionBefore} → {item.versionAfter}
                </p>
                <p className="event-list__meta">{formatDateTime(item.timestamp)}</p>
                <p className="event-list__meta">{item.notes}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}

import { Link } from 'react-router-dom'
import { Card } from '@/components/common/Card'
import { StatusBadge } from '@/components/common/StatusBadge'
import type { SiteHealth } from '@/types/site'

interface SiteOverviewProps {
  site: SiteHealth
}

export function SiteOverview({ site }: SiteOverviewProps) {
  return (
    <Card title="Site overview">
      <div className="site-overview">
        <dl className="detail-grid">
          <div>
            <dt>Site ID</dt>
            <dd>{site.siteId}</dd>
          </div>
          <div>
            <dt>Site name</dt>
            <dd>{site.siteName}</dd>
          </div>
          <div>
            <dt>Region</dt>
            <dd>{site.region}</dd>
          </div>
          <div>
            <dt>Technology</dt>
            <dd>{site.technology}</dd>
          </div>
          <div>
            <dt>Vendor</dt>
            <dd>{site.vendor}</dd>
          </div>
          <div>
            <dt>Site type</dt>
            <dd>{site.siteType}</dd>
          </div>
          <div>
            <dt>Backhaul</dt>
            <dd>{site.backhaulType}</dd>
          </div>
          <div>
            <dt>Criticality</dt>
            <dd>{site.criticality}</dd>
          </div>
          <div>
            <dt>Health</dt>
            <dd>
              <StatusBadge status={site.healthStatus} />
            </dd>
          </div>
          <div>
            <dt>Active alarms</dt>
            <dd>
              <Link className="table-link" to={`/alarms?site=${site.siteId}`}>
                {site.activeAlarmCount}
              </Link>
            </dd>
          </div>
        </dl>
        <div className="site-overview__links">
          <Link className="btn btn--secondary" to={`/alarms?site=${site.siteId}`}>
            Related alarms
          </Link>
          <Link className="btn btn--secondary" to={`/incidents?site=${site.siteId}`}>
            Related incidents
          </Link>
        </div>
      </div>
    </Card>
  )
}

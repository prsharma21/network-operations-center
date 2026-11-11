import { Link } from 'react-router-dom'
import { Card } from '@/components/common/Card'
import { SeverityBadge } from '@/components/common/SeverityBadge'
import { StatusBadge } from '@/components/common/StatusBadge'
import type { IncidentInvestigation } from '@/types/incident'
import { investigationStatusLabel, investigationStatusTone } from '@/types/incident'
import { formatDateTime } from '@/utils/format'
import { friendlyIncidentTitle } from '@/utils/plainLanguage'

interface IncidentSummaryProps {
  incident: IncidentInvestigation
}

export function IncidentSummary({ incident }: IncidentSummaryProps) {
  return (
    <Card title="Problem summary">
      <div className="investigation-status" role="status">
        <StatusBadge
          status={investigationStatusTone(incident.investigationStatus)}
          label={investigationStatusLabel(incident.investigationStatus)}
        />
        <p>
          {incident.investigationStatus === 'completed'
            ? 'Possible causes are ready below. Please review them — nothing is confirmed yet.'
            : incident.investigationStatus === 'in_progress'
              ? 'Gathering alerts, site health, and recent changes…'
              : incident.investigationStatus === 'failed'
                ? incident.investigationError ?? 'The last investigation attempt failed.'
                : 'Not investigated yet. Click Investigate to start.'}
        </p>
      </div>
      <dl className="detail-grid detail-grid--incident">
        <div>
          <dt>Problem ID</dt>
          <dd>{incident.incidentId}</dd>
        </div>
        <div>
          <dt>What happened</dt>
          <dd>{friendlyIncidentTitle(incident.title)}</dd>
        </div>
        <div>
          <dt>Severity</dt>
          <dd><SeverityBadge severity={incident.severity} /></dd>
        </div>
        <div>
          <dt>Priority</dt>
          <dd>{incident.priority}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd><StatusBadge status={incident.status} /></dd>
        </div>
        <div>
          <dt>Created</dt>
          <dd>{formatDateTime(incident.createdAt)}</dd>
        </div>
        <div className="detail-grid__wide">
          <dt>Affected sites</dt>
          <dd>
            <ul className="incident-site-list">
              {incident.affectedSites.map((site) => (
                <li key={site.siteId}>
                  <Link to={`/sites/${site.siteId}`}>{site.siteId}</Link>
                  <span> · {site.siteName}</span>
                </li>
              ))}
            </ul>
          </dd>
        </div>
      </dl>
    </Card>
  )
}

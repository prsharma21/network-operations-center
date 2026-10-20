import { Link } from 'react-router-dom'
import { Card } from '@/components/common/Card'
import { SeverityBadge } from '@/components/common/SeverityBadge'
import { StatusBadge } from '@/components/common/StatusBadge'
import type { IncidentInvestigation } from '@/types/incident'
import { investigationStatusLabel, investigationStatusTone } from '@/types/incident'
import { formatDateTime } from '@/utils/format'

interface IncidentSummaryProps {
  incident: IncidentInvestigation
}

export function IncidentSummary({ incident }: IncidentSummaryProps) {
  return (
    <Card title="Incident summary">
      <div className="investigation-status" role="status">
        <StatusBadge
          status={investigationStatusTone(incident.investigationStatus)}
          label={investigationStatusLabel(incident.investigationStatus)}
        />
        <p>
          {incident.investigationStatus === 'completed'
            ? 'Candidate causes are ranked hypotheses for operator review. They are not verified root causes.'
            : incident.investigationStatus === 'in_progress'
              ? 'Collecting correlated alarms, telemetry, topology, and change history.'
              : incident.investigationStatus === 'failed'
                ? incident.investigationError ?? 'The last investigation attempt failed.'
                : 'No investigation has been run yet. Evidence below is source data, not a diagnosis.'}
        </p>
      </div>
      <dl className="detail-grid detail-grid--incident">
        <div>
          <dt>Incident ID</dt>
          <dd>{incident.incidentId}</dd>
        </div>
        <div>
          <dt>Title</dt>
          <dd>{incident.title}</dd>
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

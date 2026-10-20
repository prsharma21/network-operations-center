import { Link } from 'react-router-dom'
import { Card } from '@/components/common/Card'
import { SeverityBadge } from '@/components/common/SeverityBadge'
import { StatusBadge } from '@/components/common/StatusBadge'
import { ProvenanceNote } from '@/components/reports/ProvenanceNote'
import type { IncidentReport } from '@/types/report'
import { investigationStatusLabel, investigationStatusTone } from '@/types/incident'
import { formatDateTime } from '@/utils/format'

interface ReportHeaderProps {
  report: IncidentReport
}

export function ReportHeader({ report }: ReportHeaderProps) {
  return (
    <Card title="Incident summary">
      <ProvenanceNote kind="observed">
        Identifiers, severity, sites, and operational status are copied from incident records. This summary is not a confirmed root cause.
      </ProvenanceNote>
      <dl className="detail-grid detail-grid--incident">
        <div>
          <dt>Report ID</dt>
          <dd>{report.reportId}</dd>
        </div>
        <div>
          <dt>Incident ID</dt>
          <dd>
            <Link to={`/incidents/${report.incidentId}`}>{report.incidentId}</Link>
          </dd>
        </div>
        <div>
          <dt>Severity</dt>
          <dd><SeverityBadge severity={report.severity} /></dd>
        </div>
        <div>
          <dt>Priority</dt>
          <dd>{report.priority}</dd>
        </div>
        <div>
          <dt>Current status</dt>
          <dd><StatusBadge status={report.status} /></dd>
        </div>
        <div>
          <dt>Investigation</dt>
          <dd>
            <StatusBadge
              status={investigationStatusTone(report.investigationStatus)}
              label={investigationStatusLabel(report.investigationStatus)}
            />
          </dd>
        </div>
        <div>
          <dt>Created</dt>
          <dd>{formatDateTime(report.createdAt)}</dd>
        </div>
        <div>
          <dt>Report generated</dt>
          <dd>{formatDateTime(report.generatedAt)}</dd>
        </div>
        <div className="detail-grid__wide">
          <dt>Title</dt>
          <dd>{report.title}</dd>
        </div>
        <div className="detail-grid__wide">
          <dt>Summary</dt>
          <dd>{report.summary}</dd>
        </div>
        <div className="detail-grid__wide">
          <dt>Affected sites</dt>
          <dd>
            {report.affectedSites.length === 0 ? (
              'None recorded.'
            ) : (
              <ul className="incident-site-list">
                {report.affectedSites.map((site) => (
                  <li key={site.siteId}>
                    <Link to={`/sites/${site.siteId}`}>{site.siteId}</Link>
                    <span> · {site.siteName}</span>
                  </li>
                ))}
              </ul>
            )}
          </dd>
        </div>
      </dl>
    </Card>
  )
}

import { Link } from 'react-router-dom'
import { SeverityBadge } from '@/components/common/SeverityBadge'
import { StatusBadge } from '@/components/common/StatusBadge'
import type { ApprovalRequest } from '@/types/approval'
import { approvalStatusLabel, approvalStatusTone } from '@/types/approval'
import { formatDateTime } from '@/utils/format'

interface ApprovalRecordProps {
  request: ApprovalRequest
  showIncidentLink?: boolean
}

export function ApprovalRecord({ request, showIncidentLink = false }: ApprovalRecordProps) {
  return (
    <div className="approval-record">
      <dl className="detail-grid detail-grid--incident">
        <div>
          <dt>Incident ID</dt>
          <dd>
            {showIncidentLink ? (
              <Link to={`/incidents/${request.incidentId}`}>{request.incidentId}</Link>
            ) : (
              request.incidentId
            )}
          </dd>
        </div>
        <div className="detail-grid__wide">
          <dt>Title</dt>
          <dd>{request.title}</dd>
        </div>
        <div>
          <dt>Severity</dt>
          <dd><SeverityBadge severity={request.severity} /></dd>
        </div>
        <div>
          <dt>Priority</dt>
          <dd>{request.priority}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>
            <StatusBadge
              status={approvalStatusTone(request.status)}
              label={approvalStatusLabel(request.status)}
            />
          </dd>
        </div>
        <div>
          <dt>Approver</dt>
          <dd>{request.approver ?? 'Awaiting human decision'}</dd>
        </div>
        <div>
          <dt>Requested</dt>
          <dd>{formatDateTime(request.requestedAt)}</dd>
        </div>
        <div>
          <dt>Decided</dt>
          <dd>{request.decidedAt ? formatDateTime(request.decidedAt) : '—'}</dd>
        </div>
        <div className="detail-grid__wide">
          <dt>Proposed next step</dt>
          <dd>{request.proposedAction}</dd>
        </div>
        <div className="detail-grid__wide">
          <dt>Recommendation rationale</dt>
          <dd>{request.rationale}</dd>
        </div>
        {request.risks ? (
          <div className="detail-grid__wide">
            <dt>Potential risks</dt>
            <dd>{request.risks}</dd>
          </div>
        ) : null}
        {request.expectedOutcome ? (
          <div className="detail-grid__wide">
            <dt>Expected outcome</dt>
            <dd>{request.expectedOutcome}</dd>
          </div>
        ) : null}
      </dl>

      <div className="approval-record__evidence">
        <h4>Supporting evidence</h4>
        {request.evidence.length === 0 ? (
          <p className="muted">No evidence references were provided.</p>
        ) : (
          <ul>
            {request.evidence.map((item, index) => (
              <li key={`${item.sourceEventId}-${index}`}>
                <span>{item.summary}</span>
                <span className="muted">
                  {item.source} · {item.sourceEventId}
                  {Number.isNaN(new Date(item.timestamp).getTime()) ? '' : ` · ${formatDateTime(item.timestamp)}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="approval-record__audit">
        <h4>Audit trail</h4>
        {request.audit.length === 0 ? (
          <p className="muted">No audit entries yet. A decision will be recorded here after submission.</p>
        ) : (
          <ol>
            {request.audit.map((entry, index) => (
              <li key={`${entry.timestamp}-${entry.decision}-${index}`}>
                <span className="approval-record__audit-decision">{entry.decision}</span>
                <span>{entry.actor} · {formatDateTime(entry.timestamp)}</span>
                <span className="muted">{entry.comment}</span>
                <span className="muted">Execution: not executed</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}

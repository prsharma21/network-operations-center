import { Card } from '@/components/common/Card'
import { EmptyState } from '@/components/common/EmptyState'
import { StatusBadge } from '@/components/common/StatusBadge'
import { ApprovalRecord } from '@/components/approvals/ApprovalRecord'
import { CandidateCauses } from '@/components/incidents/CandidateCauses'
import { CorrelatedAlarms } from '@/components/incidents/CorrelatedAlarms'
import { IncidentTimeline } from '@/components/incidents/IncidentTimeline'
import { ProvenanceNote } from '@/components/reports/ProvenanceNote'
import { ReportHeader } from '@/components/reports/ReportHeader'
import { RunbookPassageCard } from '@/components/runbooks/RunbookPassageCard'
import type { IncidentReport } from '@/types/report'
import { approvalStatusLabel } from '@/types/approval'
import { formatDateTime } from '@/utils/format'

interface ReportDocumentProps {
  report: IncidentReport
}

export function ReportDocument({ report }: ReportDocumentProps) {
  const terms = report.correlatedAlarms.map((alarm) => alarm.alarmType)
  const activity = report.timeline.filter((event) => event.kind === 'investigation' || event.kind === 'approval')

  return (
    <article className="report-document">
      <ReportHeader report={report} />

      <section>
        <IncidentTimeline events={report.timeline} />
        <ProvenanceNote kind="observed">
          Timeline entries keep their source event IDs. Alarm, KPI, and deployment rows are observed facts. Investigation and approval rows are labeled separately.
        </ProvenanceNote>
      </section>

      <section>
        <CorrelatedAlarms alarms={report.correlatedAlarms} />
        <ProvenanceNote kind="observed">
          Correlated alarms are observed records. No additional alarms were inferred for this report.
        </ProvenanceNote>
      </section>

      <section>
        <IncidentTimeline
          events={report.kpiAnomalies}
          title="KPI anomalies"
          emptyTitle="No KPI anomalies recorded"
          emptyDescription="This report does not invent telemetry. KPI rows appear only when the incident timeline already contains them."
        />
        <ProvenanceNote kind="observed">
          KPI anomalies are copied from the incident timeline. Missing KPI evidence is left blank.
        </ProvenanceNote>
      </section>

      <section>
        <CandidateCauses
          candidates={report.candidates}
          investigationStatus={report.investigationStatus}
          emptyDescription="No candidate causes were supplied for this report. Hypotheses are not invented when the investigation did not return them."
        />
        <ProvenanceNote kind="hypothesis">
          Confidence and uncertainty are backend-supplied estimates. They are not verified root causes.
        </ProvenanceNote>
      </section>

      <Card title="Retrieved runbook passages">
        <ProvenanceNote kind="observed">
          Passages and source references are shown only when retrieval returned them. Unmatched knowledge is not filled in.
        </ProvenanceNote>
        {report.runbookPassages.length === 0 ? (
          <EmptyState
            compact
            title={report.runbookRetrieval === 'empty' ? 'No relevant runbook evidence' : 'No runbook passages recorded'}
            description="This report does not generate procedures. Source-grounded passages appear only when they were retrieved for the incident."
          />
        ) : (
          <div className="runbook-results">
            {report.runbookPassages.map((passage) => (
              <RunbookPassageCard key={passage.id} passage={passage} terms={terms} />
            ))}
          </div>
        )}
      </Card>

      <Card title="Recommended next steps">
        <ProvenanceNote kind="recommendation">
          The next step is the recorded recommendation for human review. It is not a network command and is not executed from this report.
        </ProvenanceNote>
        {!report.recommendation ? (
          <EmptyState compact title="No recommendation recorded" description="This report does not invent a remediation. A next step appears only when the incident already has a recommendation." />
        ) : (
          <dl className="detail-grid detail-grid--incident">
            <div className="detail-grid__wide">
              <dt>Proposed next step</dt>
              <dd>{report.recommendation.proposedAction}</dd>
            </div>
            <div className="detail-grid__wide">
              <dt>Rationale</dt>
              <dd>{report.recommendation.rationale}</dd>
            </div>
            {report.recommendation.risks ? (
              <div className="detail-grid__wide">
                <dt>Potential risks</dt>
                <dd>{report.recommendation.risks}</dd>
              </div>
            ) : null}
            {report.recommendation.expectedOutcome ? (
              <div className="detail-grid__wide">
                <dt>Expected outcome</dt>
                <dd>{report.recommendation.expectedOutcome}</dd>
              </div>
            ) : null}
          </dl>
        )}
      </Card>

      <Card title="Human approval and action status">
        <ProvenanceNote kind="human_decision">
          Approval records a human decision. Action status is not executed unless a backend execution record exists — this console never performs a network change.
        </ProvenanceNote>
        <dl className="detail-grid detail-grid--incident">
          <div>
            <dt>Action status</dt>
            <dd><StatusBadge status="pending" label="Not executed" /></dd>
          </div>
          <div>
            <dt>Recorded action status</dt>
            <dd>{report.actionStatus.replaceAll('_', ' ')}</dd>
          </div>
        </dl>
        {report.recommendation ? (
          <>
            <p className="muted">Approval status: {approvalStatusLabel(report.recommendation.status)}</p>
            <ApprovalRecord request={report.recommendation} />
          </>
        ) : (
          <EmptyState compact title="No approval recorded" description="This report does not invent a human decision. Approve, reject, or defer on the incident or approvals page first." />
        )}
      </Card>

      <Card title="Audit history">
        <ProvenanceNote kind="human_decision">
          Audit rows are copied from recorded investigation and approval events. Missing history is not invented.
        </ProvenanceNote>
        {report.audit.length === 0 && activity.length === 0 ? (
          <EmptyState compact title="No audit history recorded" description="Human decisions and investigation steps appear here only when they were stored on the incident." />
        ) : (
          <div className="report-audit">
            {report.audit.length > 0 ? (
              <ol>
                {report.audit.map((entry, index) => (
                  <li key={`${entry.timestamp}-${entry.decision}-${index}`}>
                    <span className="approval-record__audit-decision">{entry.decision}</span>
                    <span>{entry.actor} · {formatDateTime(entry.timestamp)}</span>
                    <span className="muted">{entry.comment}</span>
                    <span className="muted">Execution: {entry.execution.replaceAll('_', ' ')}</span>
                  </li>
                ))}
              </ol>
            ) : null}
            {activity.length > 0 ? (
              <ol className="incident-timeline">
                {activity.map((event) => (
                  <li key={event.id} className={`incident-timeline__item incident-timeline__item--${event.kind}`}>
                    <div className="incident-timeline__marker" aria-hidden="true" />
                    <div>
                      <p className="incident-timeline__kind">{event.kind === 'approval' ? 'Human decision' : 'Investigation'}</p>
                      <p className="incident-timeline__title">{event.title}</p>
                      <p className="incident-timeline__detail">{event.detail}</p>
                      <p className="incident-timeline__meta">
                        {formatDateTime(event.timestamp)} · source {event.sourceEventId}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            ) : null}
          </div>
        )}
      </Card>
    </article>
  )
}

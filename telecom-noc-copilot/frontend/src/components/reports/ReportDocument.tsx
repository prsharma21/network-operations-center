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
          Timeline rows are real events. Alerts, health checks, and software changes are facts. Investigation and approval rows are labeled separately.
        </ProvenanceNote>
      </section>

      <section>
        <CorrelatedAlarms alarms={report.correlatedAlarms} />
        <ProvenanceNote kind="observed">
          Related alerts are real records. Extra alerts are not invented for this report.
        </ProvenanceNote>
      </section>

      <section>
        <IncidentTimeline
          events={report.kpiAnomalies}
          title="Health warnings"
          emptyTitle="No health warnings recorded"
          emptyDescription="Health rows appear only when they were already recorded for this problem."
        />
        <ProvenanceNote kind="observed">
          Health warnings are copied from the problem timeline. Missing health evidence stays blank.
        </ProvenanceNote>
      </section>

      <section>
        <CandidateCauses
          candidates={report.candidates}
          investigationStatus={report.investigationStatus}
          emptyDescription="No possible causes were returned for this report. Guesses are not invented."
        />
        <ProvenanceNote kind="hypothesis">
          Confidence scores are estimates. They are not confirmed root causes.
        </ProvenanceNote>
      </section>

      <Card title="Suggested checks from guides">
        <ProvenanceNote kind="observed">
          Guide excerpts appear only when a search found them. Missing guides are not filled in.
        </ProvenanceNote>
        {report.runbookPassages.length === 0 ? (
          <EmptyState
            compact
            title={report.runbookRetrieval === 'empty' ? 'No matching guide found' : 'No guide excerpts recorded'}
            description="This report does not invent troubleshooting steps. Excerpts appear only when they were found for the problem."
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
          This is a suggestion for a person to review. It is not a network command and is not run from this report.
        </ProvenanceNote>
        {!report.recommendation ? (
          <EmptyState compact title="No recommendation recorded" description="A next step appears only when the problem already has one." />
        ) : (
          <dl className="detail-grid detail-grid--incident">
            <div className="detail-grid__wide">
              <dt>Suggested next step</dt>
              <dd>{report.recommendation.proposedAction}</dd>
            </div>
            <div className="detail-grid__wide">
              <dt>Why</dt>
              <dd>{report.recommendation.rationale}</dd>
            </div>
            {report.recommendation.risks ? (
              <div className="detail-grid__wide">
                <dt>Risks</dt>
                <dd>{report.recommendation.risks}</dd>
              </div>
            ) : null}
            {report.recommendation.expectedOutcome ? (
              <div className="detail-grid__wide">
                <dt>Expected result</dt>
                <dd>{report.recommendation.expectedOutcome}</dd>
              </div>
            ) : null}
          </dl>
        )}
      </Card>

      <Card title="Human decision">
        <ProvenanceNote kind="human_decision">
          Approval records a human decision. This screen never changes the live network.
        </ProvenanceNote>
        <dl className="detail-grid detail-grid--incident">
          <div>
            <dt>Action status</dt>
            <dd><StatusBadge status="pending" label="Not executed" /></dd>
          </div>
          <div>
            <dt>Recorded status</dt>
            <dd>{report.actionStatus.replaceAll('_', ' ')}</dd>
          </div>
        </dl>
        {report.recommendation ? (
          <>
            <p className="muted">Approval status: {approvalStatusLabel(report.recommendation.status)}</p>
            <ApprovalRecord request={report.recommendation} />
          </>
        ) : (
          <EmptyState compact title="No approval recorded" description="Approve, reject, or defer on the problem or Approvals page first." />
        )}
      </Card>

      <Card title="Activity history">
        <ProvenanceNote kind="human_decision">
          History rows come from saved investigation and approval events. Missing history is not invented.
        </ProvenanceNote>
        {report.audit.length === 0 && activity.length === 0 ? (
          <EmptyState compact title="No activity yet" description="Investigation steps and human decisions appear here only when they were saved." />
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

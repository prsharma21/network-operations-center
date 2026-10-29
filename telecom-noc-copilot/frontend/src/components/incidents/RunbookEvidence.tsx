import { Link } from 'react-router-dom'
import { Button } from '@/components/common/Button'
import { Card } from '@/components/common/Card'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorMessage } from '@/components/common/ErrorMessage'
import { LoadingIndicator } from '@/components/common/LoadingIndicator'
import { RunbookPassageCard } from '@/components/runbooks/RunbookPassageCard'
import type { IncidentInvestigation } from '@/types/incident'

interface RunbookEvidenceProps {
  incident: IncidentInvestigation
  investigating: boolean
  retrieving: boolean
  error: string | null
  onRetrieve: () => void
}

export function RunbookEvidence({
  incident,
  investigating,
  retrieving,
  error,
  onRetrieve,
}: RunbookEvidenceProps) {
  const loading = investigating || retrieving || incident.investigationStatus === 'in_progress'
  const passages = incident.runbookPassages ?? []
  const terms = [
    ...(incident.correlatedAlarms ?? []).map((alarm) => alarm.alarmType),
    ...incident.title.split(/\s+/),
  ]

  return (
    <Card title="Runbook evidence">
      <p className="runbook-evidence__note" role="note">
        Source-grounded retrieval only. These passages are separate from AI candidate causes and are not a confirmed root cause.
      </p>

      {loading ? (
        <LoadingIndicator label="Retrieving runbook passages" />
      ) : null}

      {error ? (
        <ErrorMessage
          title="Runbook retrieval failed"
          message={error}
          action={<Button variant="secondary" onClick={onRetrieve}>Retry</Button>}
        />
      ) : null}

      {!loading && !error && incident.investigationStatus === 'not_started' ? (
        <EmptyState
          compact
          title="No runbook evidence yet"
          description="Run Investigate Incident to retrieve passages used for this investigation. No procedure is generated until retrieval returns a source document."
        />
      ) : null}

      {!loading && !error && incident.runbookRetrieval === 'empty' ? (
        <EmptyState
          compact
          title="No relevant runbook evidence"
          description="Retrieval returned no matching passage for this incident context. No troubleshooting procedure was generated."
          action={
            <div className="runbook-evidence__actions">
              <Button variant="secondary" onClick={onRetrieve}>Retry retrieval</Button>
              <Link className="btn btn--secondary" to={`/runbooks?incident=${encodeURIComponent(incident.incidentId)}`}>
                Open runbook search
              </Link>
            </div>
          }
        />
      ) : null}

      {!loading && !error && incident.runbookRetrieval === 'retrieved' ? (
        <div className="runbook-results">
          {passages.map((passage) => (
            <RunbookPassageCard key={passage.id} passage={passage} terms={terms} />
          ))}
          <p className="muted">
            <Link to={`/runbooks?incident=${encodeURIComponent(incident.incidentId)}`}>Search the runbook index</Link>
            {' '}for additional context. Citations above point at indexed documents only.
          </p>
        </div>
      ) : null}

      {!loading && !error && incident.runbookRetrieval === 'failed' ? (
        <ErrorMessage
          title="Runbook retrieval failed"
          message="The investigation finished, but no runbook passages could be attached."
          action={<Button variant="secondary" onClick={onRetrieve}>Retry retrieval</Button>}
        />
      ) : null}
    </Card>
  )
}

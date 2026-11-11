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
    <Card title="Suggested checks">
      <p className="runbook-evidence__note" role="note">
        These are checklist steps from troubleshooting guides. They help investigation — they are not a final confirmed cause.
      </p>

      {loading ? (
        <LoadingIndicator label="Loading suggested checks" />
      ) : null}

      {error ? (
        <ErrorMessage
          title="Guide search failed"
          message={error}
          action={<Button variant="secondary" onClick={onRetrieve}>Retry</Button>}
        />
      ) : null}

      {!loading && !error && incident.investigationStatus === 'not_started' ? (
        <EmptyState
          compact
          title="No suggested checks yet"
          description="Click Investigate to load the suggested checklist for this problem."
        />
      ) : null}

      {!loading && !error && incident.runbookRetrieval === 'empty' ? (
        <EmptyState
          compact
          title="No matching guide found"
          description="No guide matched this problem. Nothing was invented."
          action={
            <div className="runbook-evidence__actions">
              <Button variant="secondary" onClick={onRetrieve}>Try again</Button>
              <Link className="btn btn--secondary" to={`/runbooks?incident=${encodeURIComponent(incident.incidentId)}`}>
                Open guide search
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
            <Link to={`/runbooks?incident=${encodeURIComponent(incident.incidentId)}`}>Search more guides</Link>
            {' '}if you need extra context. Links above point at real guide documents only.
          </p>
        </div>
      ) : null}

      {!loading && !error && incident.runbookRetrieval === 'failed' ? (
        <ErrorMessage
          title="Guide search failed"
          message="Investigation finished, but no guide excerpts could be attached."
          action={<Button variant="secondary" onClick={onRetrieve}>Try again</Button>}
        />
      ) : null}
    </Card>
  )
}

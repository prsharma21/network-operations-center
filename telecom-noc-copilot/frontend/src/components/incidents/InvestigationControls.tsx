import { Link } from 'react-router-dom'
import { Button } from '@/components/common/Button'
import { Card } from '@/components/common/Card'
import { LoadingIndicator } from '@/components/common/LoadingIndicator'
import type { IncidentInvestigation } from '@/types/incident'

interface InvestigationControlsProps {
  incident: IncidentInvestigation
  investigating: boolean
  onInvestigate: () => void
}

export function InvestigationControls({ incident, investigating, onInvestigate }: InvestigationControlsProps) {
  const running = investigating || incident.investigationStatus === 'in_progress'
  const completed = incident.investigationStatus === 'completed'
  const failed = incident.investigationStatus === 'failed'

  return (
    <Card title="Investigation controls">
      <div className="investigation-controls">
        <Button
          onClick={onInvestigate}
          disabled={running}
          aria-busy={running}
        >
          Investigate Incident
        </Button>
        {running ? (
          <div className="investigation-controls__state" role="status">
            <LoadingIndicator size="sm" label="Investigation in progress" />
            <p className="muted">A second request is disabled until this run finishes. No remediation is executed from this page.</p>
          </div>
        ) : null}
        {completed && !running ? (
          <div className="investigation-controls__state investigation-controls__state--success" role="status">
            <p>Investigation finished. Review ranked hypotheses below — they are not a confirmed root cause.</p>
            {incident.reportHref ? (
              <p>
                Generated report:{' '}
                <Link to={incident.reportHref}>{incident.reportId ?? 'Open report'}</Link>
              </p>
            ) : (
              <p className="muted">No report identifier was returned.</p>
            )}
          </div>
        ) : null}
        {failed && !running ? (
          <div className="investigation-controls__state investigation-controls__state--failed" role="alert">
            <p>{incident.investigationError ?? 'Investigation failed. You can retry.'}</p>
          </div>
        ) : null}
        {!running && !completed && !failed ? (
          <p className="muted">Investigation correlates alarms and evidence only. Remediation execution is not available here.</p>
        ) : null}
      </div>
    </Card>
  )
}

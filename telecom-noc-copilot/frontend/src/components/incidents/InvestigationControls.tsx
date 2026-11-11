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
    <Card title="Investigate">
      <div className="investigation-controls">
        <Button
          onClick={onInvestigate}
          disabled={running}
          aria-busy={running}
        >
          Investigate this problem
        </Button>
        {running ? (
          <div className="investigation-controls__state" role="status">
            <LoadingIndicator size="sm" label="Looking into this…" />
            <p className="muted">Please wait. This only reviews data — it does not change the live network.</p>
          </div>
        ) : null}
        {completed && !running ? (
          <div className="investigation-controls__state investigation-controls__state--success" role="status">
            <p>Done. Scroll down to review possible causes.</p>
            {incident.reportHref ? (
              <p>
                Report:{' '}
                <Link to={incident.reportHref}>{incident.reportId ?? 'Open report'}</Link>
              </p>
            ) : (
              <p className="muted">No report link yet.</p>
            )}
          </div>
        ) : null}
        {failed && !running ? (
          <div className="investigation-controls__state investigation-controls__state--failed" role="alert">
            <p>{incident.investigationError ?? 'Investigation failed. You can try again.'}</p>
          </div>
        ) : null}
        {!running && !completed && !failed ? (
          <p className="muted">This reviews alerts and evidence only. It will not change the live network.</p>
        ) : null}
      </div>
    </Card>
  )
}

import { Card } from '@/components/common/Card'
import { EmptyState } from '@/components/common/EmptyState'
import type { CandidateCause, EvidenceRef } from '@/types/incident'
import { formatDateTime } from '@/utils/format'
import {
  friendlyEvidenceSummary,
  friendlyIncidentTitle,
  friendlySourceLabel,
} from '@/utils/plainLanguage'

interface CandidateCausesProps {
  candidates: CandidateCause[]
  investigationStatus: string
  emptyDescription?: string
}

function EvidenceList({ heading, items }: { heading: string; items: EvidenceRef[] }) {
  return (
    <div className="candidate__evidence">
      <h5>{heading}</h5>
      {items.length === 0 ? (
        <p className="muted">None yet.</p>
      ) : (
        <ul>
          {items.map((item, index) => (
            <li key={`${heading}-${item.sourceEventId}-${index}`}>
              <span>{friendlyEvidenceSummary(item.summary)}</span>
              <span className="muted">
                {friendlySourceLabel(item.source)}
                {item.sourceEventId ? ` · ${item.sourceEventId}` : ''}
                {Number.isNaN(new Date(item.timestamp).getTime()) ? '' : ` · ${formatDateTime(item.timestamp)}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function CandidateCauses({
  candidates = [],
  investigationStatus,
  emptyDescription = 'Click Investigate to see the most likely causes.',
}: CandidateCausesProps) {
  return (
    <Card title="Possible causes">
      <p className="candidate-disclaimer" role="note">
        These are best guesses for review. They are not a final confirmed cause.
      </p>
      {candidates.length === 0 ? (
        <EmptyState
          compact
          title={investigationStatus === 'in_progress' ? 'Checking possible causes…' : 'No possible causes yet'}
          description={emptyDescription}
        />
      ) : (
        <ol className="candidate-list">
          {candidates.map((candidate) => (
            <li key={candidate.rank} className="candidate">
              <div className="candidate__header">
                <p className="candidate__rank">#{candidate.rank}</p>
                <div>
                  <p className="candidate__title">{friendlyIncidentTitle(candidate.title)}</p>
                  <p className="candidate__hypothesis">{friendlyEvidenceSummary(candidate.hypothesis)}</p>
                </div>
                <div className="candidate__confidence">
                  <span className={`uncertainty uncertainty--${candidate.uncertainty}`}>
                    {candidate.uncertainty === 'low' ? 'More confident' : candidate.uncertainty === 'high' ? 'Less confident' : 'Medium confidence'}
                  </span>
                  <p>Confidence {candidate.confidencePct}%</p>
                  <p className="muted">Needs human review</p>
                </div>
              </div>
              <div className="candidate__columns">
                <EvidenceList heading="Why this looks likely" items={candidate.supporting} />
                <EvidenceList heading="What argues against it" items={candidate.contradictory} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}

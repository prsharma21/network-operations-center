import { Card } from '@/components/common/Card'
import { EmptyState } from '@/components/common/EmptyState'
import type { CandidateCause, EvidenceRef } from '@/types/incident'
import { formatDateTime } from '@/utils/format'

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
        <p className="muted">None recorded.</p>
      ) : (
        <ul>
          {items.map((item, index) => (
            <li key={`${heading}-${item.sourceEventId}-${index}`}>
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
  )
}

export function CandidateCauses({
  candidates = [],
  investigationStatus,
  emptyDescription = 'Run Investigate Incident to generate ranked hypotheses with supporting and contradictory evidence.',
}: CandidateCausesProps) {
  return (
    <Card title="Candidate root causes">
      <p className="candidate-disclaimer" role="note">
        Ranked AI hypotheses only. Confidence is an uncertainty estimate, not a verified fact.
        Do not treat any candidate as a confirmed root cause.
      </p>
      {candidates.length === 0 ? (
        <EmptyState
          compact
          title={investigationStatus === 'in_progress' ? 'Ranking candidates' : 'No candidates yet'}
          description={emptyDescription}
        />
      ) : (
        <ol className="candidate-list">
          {candidates.map((candidate) => (
            <li key={candidate.rank} className="candidate">
              <div className="candidate__header">
                <p className="candidate__rank">#{candidate.rank}</p>
                <div>
                  <p className="candidate__title">{candidate.title}</p>
                  <p className="candidate__hypothesis">{candidate.hypothesis}</p>
                </div>
                <div className="candidate__confidence">
                  <span className={`uncertainty uncertainty--${candidate.uncertainty}`}>
                    {candidate.uncertainty} uncertainty
                  </span>
                  <p>Estimated confidence {candidate.confidencePct}%</p>
                  <p className="muted">Not a verified fact</p>
                </div>
              </div>
              <div className="candidate__columns">
                <EvidenceList heading="Supporting evidence" items={candidate.supporting} />
                <EvidenceList heading="Contradictory evidence" items={candidate.contradictory} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}

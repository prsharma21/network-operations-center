import { Link } from 'react-router-dom'
import { HighlightedText } from '@/components/runbooks/HighlightedText'
import type { RunbookPassage } from '@/types/runbook'
import { friendlyAlarmLabel, friendlyRunbookTitle } from '@/utils/plainLanguage'

interface RunbookPassageCardProps {
  passage: RunbookPassage
  terms: string[]
}

export function RunbookPassageCard({ passage, terms }: RunbookPassageCardProps) {
  return (
    <article className="runbook-card">
      <header className="runbook-card__header">
        <div>
          <h3 className="runbook-card__title">{friendlyRunbookTitle(passage.title)}</h3>
          <p className="muted">From guide {passage.documentId}</p>
        </div>
        <p className="muted">Guide ID {passage.documentId}</p>
      </header>

      <p className="runbook-card__excerpt">
        <HighlightedText text={passage.excerpt} terms={terms} />
      </p>

      <dl className="detail-grid detail-grid--drawer">
        <div>
          <dt>Network type</dt>
          <dd>{passage.technology.length > 0 ? passage.technology.join(', ') : '—'}</dd>
        </div>
        <div>
          <dt>Related alerts</dt>
          <dd>
            {passage.alarmTypes.length > 0
              ? passage.alarmTypes.map(friendlyAlarmLabel).join(', ')
              : '—'}
          </dd>
        </div>
        {Object.entries(passage.metadata).map(([key, value]) => (
          <div key={key}>
            <dt>{key.replaceAll('_', ' ')}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      <section className="runbook-card__section">
        <h4>What to check</h4>
        {passage.steps.length > 0 ? (
          <ol className="runbook-steps">
            {passage.steps.map((step) => (
              <li key={step}>
                <HighlightedText text={step} terms={terms} />
              </li>
            ))}
          </ol>
        ) : (
          <p className="muted">This guide has no checklist steps yet.</p>
        )}
      </section>

      <section className="runbook-card__section">
        <h4>Health number meanings</h4>
        {passage.kpis.length > 0 ? (
          <ul className="runbook-kpis">
            {passage.kpis.map((kpi) => (
              <li key={kpi.name}>
                <strong>{kpi.name === 'latency' ? 'Delay' : kpi.name === 'throughput' ? 'Data speed' : kpi.name === 'utilization' ? 'Usage' : kpi.name === 'dropped-call' ? 'Dropped calls' : kpi.name}</strong>
                <span> {kpi.definition}</span>
                <div className="muted">{kpi.threshold}</div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No health-number explanations in this guide.</p>
        )}
      </section>

      <section className="runbook-card__section">
        <h4>Related problems</h4>
        <p>
          Problems:{' '}
          {passage.relatedIncidents.length > 0
            ? passage.relatedIncidents.map((item, index) => (
                <span key={item.incidentId}>
                  {index > 0 ? ', ' : ''}
                  <Link to={`/incidents/${item.incidentId}`}>{item.incidentId}</Link>
                </span>
              ))
            : 'None linked'}
        </p>
        <p className="muted">
          Past write-ups:{' '}
          {passage.relatedPostmortems.length > 0
            ? passage.relatedPostmortems.map((item) => `${item.title} (${item.sourceRef})`).join('; ')
            : 'None linked'}
        </p>
      </section>
    </article>
  )
}

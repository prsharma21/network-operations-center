import { Link } from 'react-router-dom'
import { HighlightedText } from '@/components/runbooks/HighlightedText'
import type { RunbookPassage } from '@/types/runbook'

interface RunbookPassageCardProps {
  passage: RunbookPassage
  terms: string[]
}

export function RunbookPassageCard({ passage, terms }: RunbookPassageCardProps) {
  return (
    <article className="runbook-card">
      <header className="runbook-card__header">
        <div>
          <h3 className="runbook-card__title">{passage.title}</h3>
          <p className="muted">Source {passage.sourceRef}</p>
        </div>
        <p className="muted">Document {passage.documentId}</p>
      </header>

      <p className="runbook-card__excerpt">
        <HighlightedText text={passage.excerpt} terms={terms} />
      </p>

      <dl className="detail-grid detail-grid--drawer">
        <div>
          <dt>Technology</dt>
          <dd>{passage.technology.length > 0 ? passage.technology.join(', ') : '—'}</dd>
        </div>
        <div>
          <dt>Alarm types</dt>
          <dd>{passage.alarmTypes.length > 0 ? passage.alarmTypes.join(', ') : '—'}</dd>
        </div>
        {Object.entries(passage.metadata).map(([key, value]) => (
          <div key={key}>
            <dt>{key.replaceAll('_', ' ')}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      <section className="runbook-card__section">
        <h4>Troubleshooting steps</h4>
        {passage.steps.length > 0 ? (
          <ol className="runbook-steps">
            {passage.steps.map((step) => (
              <li key={step}>
                <HighlightedText text={step} terms={terms} />
              </li>
            ))}
          </ol>
        ) : (
          <p className="muted">This passage has no indexed troubleshooting steps.</p>
        )}
      </section>

      <section className="runbook-card__section">
        <h4>KPI definitions</h4>
        {passage.kpis.length > 0 ? (
          <ul className="runbook-kpis">
            {passage.kpis.map((kpi) => (
              <li key={kpi.name}>
                <strong>{kpi.name}</strong>
                <span> {kpi.definition}</span>
                <div className="muted">{kpi.threshold}</div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No KPI definitions are attached to this passage.</p>
        )}
      </section>

      <section className="runbook-card__section">
        <h4>Related incidents and postmortems</h4>
        <p>
          Incidents:{' '}
          {passage.relatedIncidents.length > 0
            ? passage.relatedIncidents.map((item, index) => (
                <span key={item.incidentId}>
                  {index > 0 ? ', ' : ''}
                  <Link to={`/incidents/${item.incidentId}`}>{item.incidentId}</Link>
                </span>
              ))
            : 'None in the knowledge index'}
        </p>
        <p className="muted">
          Postmortems:{' '}
          {passage.relatedPostmortems.length > 0
            ? passage.relatedPostmortems.map((item) => `${item.title} (${item.sourceRef})`).join('; ')
            : 'None in the knowledge index'}
        </p>
      </section>
    </article>
  )
}

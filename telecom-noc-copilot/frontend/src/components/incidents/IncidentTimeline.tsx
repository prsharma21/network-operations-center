import { Card } from '@/components/common/Card'
import { EmptyState } from '@/components/common/EmptyState'
import type { TimelineEvent, TimelineKind } from '@/types/incident'
import { formatDateTime } from '@/utils/format'

const KIND_LABEL: Record<TimelineKind, string> = {
  alarm: 'Alarm',
  kpi: 'KPI anomaly',
  deployment: 'Deployment',
  investigation: 'Investigation',
  approval: 'Approval',
}

interface IncidentTimelineProps {
  events: TimelineEvent[]
  title?: string
  emptyTitle?: string
  emptyDescription?: string
}

export function IncidentTimeline({
  events = [],
  title = 'Timeline',
  emptyTitle = 'No timeline events',
  emptyDescription = 'Alarms, KPI anomalies, deployments, and investigation steps will appear here.',
}: IncidentTimelineProps) {
  return (
    <Card title={title}>
      {events.length === 0 ? (
        <EmptyState compact title={emptyTitle} description={emptyDescription} />
      ) : (
        <ol className="incident-timeline">
          {events.map((event) => (
            <li key={event.id} className={`incident-timeline__item incident-timeline__item--${event.kind}`}>
              <div className="incident-timeline__marker" aria-hidden="true" />
              <div>
                <p className="incident-timeline__kind">{KIND_LABEL[event.kind]}</p>
                <p className="incident-timeline__title">{event.title}</p>
                <p className="incident-timeline__detail">{event.detail}</p>
                <p className="incident-timeline__meta">
                  {formatDateTime(event.timestamp)} · source {event.sourceEventId}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}

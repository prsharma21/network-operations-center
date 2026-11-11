import { Card } from '@/components/common/Card'
import { EmptyState } from '@/components/common/EmptyState'
import type { TimelineEvent } from '@/types/incident'
import { formatDateTime } from '@/utils/format'
import {
  friendlyMetricDetail,
  friendlyTimelineKind,
  friendlyTimelineTitle,
} from '@/utils/plainLanguage'

interface IncidentTimelineProps {
  events: TimelineEvent[]
  title?: string
  emptyTitle?: string
  emptyDescription?: string
}

export function IncidentTimeline({
  events = [],
  title = 'What happened',
  emptyTitle = 'No events yet',
  emptyDescription = 'Alerts, health checks, and investigation steps will appear here.',
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
                <p className="incident-timeline__kind">{friendlyTimelineKind(event.kind)}</p>
                <p className="incident-timeline__title">{friendlyTimelineTitle(event.title, event.kind)}</p>
                <p className="incident-timeline__detail">{friendlyMetricDetail(event.detail)}</p>
                <p className="incident-timeline__meta">
                  {formatDateTime(event.timestamp)}
                  {event.sourceEventId ? ` · ref ${event.sourceEventId}` : ''}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}

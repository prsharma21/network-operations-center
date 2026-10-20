import { Card } from '@/components/common/Card'
import { EmptyState } from '@/components/common/EmptyState'
import { Icon } from '@/components/common/Icon'
import { SeverityBadge } from '@/components/common/SeverityBadge'
import { StatusBadge } from '@/components/common/StatusBadge'
import type { NetworkEvent } from '@/types/dashboard'
import { formatDateTime } from '@/utils/format'

interface RecentEventsListProps {
  events: NetworkEvent[]
}

export function RecentEventsList({ events }: RecentEventsListProps) {
  return (
    <Card title="Recent network events">
      {events.length === 0 ? (
        <EmptyState compact title="No events" description="No alarm or deployment events fall in this time range." />
      ) : (
        <ol className="event-list">
          {events.map((event) => (
            <li key={`${event.kind}-${event.id}`} className="event-list__item">
              <span className="event-list__icon" aria-hidden="true">
                <Icon name={event.kind === 'alarm' ? 'alarm' : 'report'} size={16} />
              </span>
              <div className="event-list__body">
                <div className="event-list__headline">
                  <strong>{event.id}</strong>
                  <span className="event-list__kind">{event.kind === 'alarm' ? 'Alarm' : 'Deployment'}</span>
                  {event.severity ? <SeverityBadge severity={event.severity} /> : <StatusBadge status="maintenance" label={event.statusLabel} />}
                </div>
                <p className="event-list__title">{event.title}</p>
                <p className="event-list__meta">
                  {event.siteName} · {formatDateTime(event.timestamp)}
                  {event.severity ? ` · ${event.statusLabel}` : null}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}

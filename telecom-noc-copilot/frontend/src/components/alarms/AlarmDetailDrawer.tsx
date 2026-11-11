import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/common/Button'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorMessage } from '@/components/common/ErrorMessage'
import { Icon } from '@/components/common/Icon'
import { LoadingIndicator } from '@/components/common/LoadingIndicator'
import { SeverityBadge } from '@/components/common/SeverityBadge'
import { StatusBadge } from '@/components/common/StatusBadge'
import { useDismiss } from '@/hooks/useDismiss'
import type { AlarmDetail } from '@/types/alarm'
import { formatDateTime } from '@/utils/format'
import { friendlyAlarmLabel, friendlyComponentLabel } from '@/utils/plainLanguage'

interface AlarmDetailDrawerProps {
  open: boolean
  loading: boolean
  error: string | null
  detail: AlarmDetail | null
  onClose: () => void
  onOpenRelated: (alarmId: string) => void
}

export function AlarmDetailDrawer({
  open,
  loading,
  error,
  detail,
  onClose,
  onOpenRelated,
}: AlarmDetailDrawerProps) {
  const panelRef = useRef<HTMLElement>(null)
  useDismiss(open, onClose, panelRef)

  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  if (!open) return null

  const alarm = detail?.alarm
  const site = detail?.site

  return (
    <div className="drawer-backdrop">
      <aside
        ref={panelRef}
        className="alarm-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="alarm-drawer-title"
      >
        <header className="alarm-drawer__header">
          <div>
            <p className="muted">Alert details</p>
            <h2 id="alarm-drawer-title">{alarm?.alarmId ?? 'Alert'}</h2>
          </div>
          <button type="button" className="icon-button" aria-label="Close alarm detail" onClick={onClose}>
            <Icon name="close" />
          </button>
        </header>

        <div className="alarm-drawer__body">
          {loading ? <LoadingIndicator label="Loading alert" /> : null}
          {error ? <ErrorMessage title="Alert detail unavailable" message={error} /> : null}

          {!loading && !error && !alarm ? (
            <EmptyState compact title="Alert not found" description="This alert ID is not in the current list." />
          ) : null}

          {alarm && !loading ? (
            <>
              <div className="alarm-drawer__badges">
                <SeverityBadge severity={alarm.severity} />
                <StatusBadge status={alarm.status} />
              </div>
              <p className="alarm-drawer__message">{alarm.message}</p>

              <dl className="detail-grid detail-grid--drawer">
                <div>
                  <dt>What it means</dt>
                  <dd>{friendlyAlarmLabel(alarm.alarmType)}</dd>
                </div>
                <div>
                  <dt>When</dt>
                  <dd>{formatDateTime(alarm.timestamp)}</dd>
                </div>
                <div>
                  <dt>Area</dt>
                  <dd>{friendlyComponentLabel(alarm.networkComponent)}</dd>
                </div>
                <div>
                  <dt>Source</dt>
                  <dd>{alarm.source ?? '—'}</dd>
                </div>
                <div>
                  <dt>Grouping key</dt>
                  <dd>{alarm.correlationKey ?? '—'}</dd>
                </div>
                <div>
                  <dt>Related problem</dt>
                  <dd>
                    {alarm.relatedIncident ? (
                      <Link to={`/incidents/${alarm.relatedIncident.incidentId}`}>{alarm.relatedIncident.incidentId}</Link>
                    ) : 'None yet'}
                  </dd>
                </div>
              </dl>

              <section className="alarm-drawer__section">
                <h3>Site details</h3>
                {site ? (
                  <dl className="detail-grid detail-grid--drawer">
                    <div>
                      <dt>Site</dt>
                      <dd><Link to={`/sites/${site.siteId}`}>{site.siteId}</Link> · {site.siteName}</dd>
                    </div>
                    <div>
                      <dt>Region</dt>
                      <dd>{site.region}</dd>
                    </div>
                    <div>
                      <dt>Network type</dt>
                      <dd>{site.technology}</dd>
                    </div>
                    <div>
                      <dt>Vendor</dt>
                      <dd>{site.vendor}</dd>
                    </div>
                    <div>
                      <dt>Site type</dt>
                      <dd>{site.siteType}</dd>
                    </div>
                    <div>
                      <dt>Site status</dt>
                      <dd><StatusBadge status={site.status} /></dd>
                    </div>
                  </dl>
                ) : (
                  <p className="muted">No extra site details are attached to this alert.</p>
                )}
              </section>

              <section className="alarm-drawer__section">
                <h3>Related alerts</h3>
                {detail && detail.relatedAlarms.length > 0 ? (
                  <ul className="alarm-related">
                    {detail.relatedAlarms.map((item) => (
                      <li key={item.alarmId}>
                        <Button variant="ghost" onClick={() => onOpenRelated(item.alarmId)}>
                          {item.alarmId}
                        </Button>
                        <span className="muted">{friendlyAlarmLabel(item.alarmType)} · {formatDateTime(item.timestamp)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">No other related alerts were found.</p>
                )}
              </section>

              <section className="alarm-drawer__section">
                <h3>Technical details</h3>
                <pre className="alarm-payload">{JSON.stringify(alarm.payload, null, 2)}</pre>
              </section>
            </>
          ) : null}
        </div>
      </aside>
    </div>
  )
}

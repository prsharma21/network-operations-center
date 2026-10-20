import { useId, useRef } from 'react'
import { EmptyState } from '@/components/common/EmptyState'
import { Icon } from '@/components/common/Icon'
import { useDismiss } from '@/hooks/useDismiss'

interface NotificationMenuProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function NotificationMenu({ open, onOpenChange }: NotificationMenuProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const panelId = useId()

  useDismiss(open, () => onOpenChange(false), containerRef)

  return (
    <div className="menu" ref={containerRef}>
      <button
        type="button"
        className="icon-button"
        aria-label="Notifications"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => onOpenChange(!open)}
      >
        <Icon name="bell" />
      </button>
      {open ? (
        <div id={panelId} className="menu__panel menu__panel--wide" role="dialog" aria-label="Notifications">
          <p className="menu__header">Notifications</p>
          <EmptyState
            compact
            title="No notifications"
            description="Alarm and approval alerts will appear here when a notification service is connected."
          />
        </div>
      ) : null}
    </div>
  )
}

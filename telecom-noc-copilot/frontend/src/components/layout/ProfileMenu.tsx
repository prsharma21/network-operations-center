import { useId, useRef } from 'react'
import { useDismiss } from '@/hooks/useDismiss'

const DEMO_ENGINEER = {
  name: 'Jordan Hale',
  role: 'NOC Engineer',
  shift: 'Shift A · Core network',
  initials: 'JH',
} as const

interface ProfileMenuProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSignOutRequest: () => void
}

export function ProfileMenu({ open, onOpenChange, onSignOutRequest }: ProfileMenuProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const menuId = useId()

  useDismiss(open, () => onOpenChange(false), containerRef)

  return (
    <div className="menu" ref={containerRef}>
      <button
        type="button"
        className="profile-button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => onOpenChange(!open)}
      >
        <span className="profile-button__avatar" aria-hidden="true">
          {DEMO_ENGINEER.initials}
        </span>
        <span className="profile-button__text">
          <span className="profile-button__name">{DEMO_ENGINEER.name}</span>
          <span className="profile-button__role">{DEMO_ENGINEER.role}</span>
        </span>
      </button>
      {open ? (
        <div id={menuId} className="menu__panel" role="menu" aria-label="Engineer profile">
          <div className="menu__identity">
            <p className="menu__header">{DEMO_ENGINEER.name}</p>
            <p className="menu__meta">{DEMO_ENGINEER.role}</p>
            <p className="menu__meta">{DEMO_ENGINEER.shift}</p>
            <p className="menu__meta">Demo profile — not a signed-in account</p>
          </div>
          <button
            type="button"
            className="menu__item"
            role="menuitem"
            aria-disabled="true"
            title="Not available in this demo"
            onClick={(event) => event.preventDefault()}
          >
            Profile settings
          </button>
          <button
            type="button"
            className="menu__item"
            role="menuitem"
            onClick={() => {
              onOpenChange(false)
              onSignOutRequest()
            }}
          >
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  )
}

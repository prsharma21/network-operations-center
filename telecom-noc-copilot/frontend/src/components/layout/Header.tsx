import { useCallback, useEffect, useState, type FormEvent, type RefObject } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/common/Button'
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog'
import { Icon } from '@/components/common/Icon'
import { NotificationMenu } from '@/components/layout/NotificationMenu'
import { ProfileMenu } from '@/components/layout/ProfileMenu'
import type { Breadcrumb } from '@/types/ui'

interface HeaderProps {
  title: string
  breadcrumbs: Breadcrumb[]
  menuButtonRef: RefObject<HTMLButtonElement>
  mobileNavOpen: boolean
  onToggleMobileNav: () => void
}

export function Header({ title, breadcrumbs, menuButtonRef, mobileNavOpen, onToggleMobileNav }: HeaderProps) {
  const [query, setQuery] = useState('')
  const [openMenu, setOpenMenu] = useState<'notifications' | 'profile' | null>(null)
  const [confirmSignOut, setConfirmSignOut] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const closeSignOut = useCallback(() => setConfirmSignOut(false), [])
  const confirmSignOutAction = useCallback(() => {
    setConfirmSignOut(false)
    setNotice('Sign-out simulated. No session was ended and no network changes were made.')
  }, [])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 8000)
    return () => window.clearTimeout(timer)
  }, [notice])

  const onSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = query.trim()
    if (!trimmed) {
      setNotice('Enter an alarm, site, or incident term to search.')
      return
    }
    setNotice('Global search is not connected. Use Alarms, Sites, or Incidents filters instead.')
  }

  return (
    <header className="header">
      <div className="header__bar">
        <button
          ref={menuButtonRef}
          type="button"
          className="icon-button header__menu-button"
          aria-label={mobileNavOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={mobileNavOpen}
          aria-controls="primary-navigation"
          onClick={onToggleMobileNav}
        >
          <Icon name={mobileNavOpen ? 'close' : 'menu'} />
        </button>

        <div className="header__titles">
          <h1 className="header__title">{title}</h1>
          <nav aria-label="Breadcrumb">
            <ol className="crumbs">
              {breadcrumbs.map((crumb, index) => {
                const isCurrent = index === breadcrumbs.length - 1
                return (
                  <li key={`${crumb.label}-${index}`} className="crumbs__item">
                    {crumb.to && !isCurrent ? (
                      <Link to={crumb.to}>{crumb.label}</Link>
                    ) : (
                      <span aria-current={isCurrent ? 'page' : undefined}>{crumb.label}</span>
                    )}
                  </li>
                )
              })}
            </ol>
          </nav>
        </div>

        <form className="header-search" role="search" onSubmit={onSearch}>
          <label className="visually-hidden" htmlFor="noc-search">
            Search alarms, sites, and incidents
          </label>
          <Icon name="search" size={16} />
          <input
            id="noc-search"
            type="search"
            value={query}
            placeholder="Search alarms, sites, incidents"
            title="Search is not connected in this shell"
            onChange={(event) => setQuery(event.target.value)}
          />
        </form>

        <div className="header__tools">
          <NotificationMenu open={openMenu === 'notifications'} onOpenChange={(next) => setOpenMenu(next ? 'notifications' : null)} />
          <ProfileMenu
            open={openMenu === 'profile'}
            onOpenChange={(next) => setOpenMenu(next ? 'profile' : null)}
            onSignOutRequest={() => setConfirmSignOut(true)}
          />
        </div>
      </div>

      {notice ? (
        <div className="header__notice" role="status">
          <span>{notice}</span>
          <Button variant="ghost" onClick={() => setNotice(null)}>
            Dismiss
          </Button>
        </div>
      ) : null}

      <ConfirmationDialog
        open={confirmSignOut}
        title="Sign out?"
        message="Confirming will not end a real session or change the network."
        confirmLabel="Sign out"
        cancelLabel="Stay signed in"
        onCancel={closeSignOut}
        onConfirm={confirmSignOutAction}
      />
    </header>
  )
}

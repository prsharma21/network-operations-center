import { useEffect, useRef, useState } from 'react'
import { Outlet, useMatches } from 'react-router-dom'
import { Header } from '@/components/layout/Header'
import { Sidebar } from '@/components/layout/Sidebar'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { isRouteHandle } from '@/types/ui'
import { appConfig } from '@/utils/config'

const COLLAPSE_STORAGE_KEY = 'noc.sidebar.collapsed'
const MOBILE_NAV_QUERY = '(max-width: 960px)'

function readCollapsedPreference(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSE_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

export function AppShell() {
  const isMobile = useMediaQuery(MOBILE_NAV_QUERY)
  const [collapsed, setCollapsed] = useState(readCollapsedPreference)
  const [mobileOpen, setMobileOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const matches = useMatches()
  const handle = [...matches].reverse().find((match) => isRouteHandle(match.handle))?.handle
  const title = isRouteHandle(handle) ? handle.title : appConfig.appTitle
  const breadcrumbs = isRouteHandle(handle) ? handle.breadcrumbs : [{ label: appConfig.appTitle }]

  useEffect(() => {
    document.title = `${title} · ${appConfig.appTitle}`
  }, [title])

  useEffect(() => {
    try {
      window.localStorage.setItem(COLLAPSE_STORAGE_KEY, String(collapsed))
    } catch {
      /* Preference storage is optional. */
    }
  }, [collapsed])

  useEffect(() => {
    if (!isMobile) setMobileOpen(false)
  }, [isMobile])

  useEffect(() => {
    if (!mobileOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileOpen(false)
        menuButtonRef.current?.focus()
      }
    }
    document.querySelector<HTMLElement>('#primary-navigation a')?.focus()
    document.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [mobileOpen])

  return (
    <div className={`app-shell${collapsed && !isMobile ? ' is-collapsed' : ''}${mobileOpen ? ' is-nav-open' : ''}`}>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <Sidebar
        collapsed={collapsed && !isMobile}
        mobileOpen={mobileOpen}
        onToggleCollapse={() => setCollapsed((current) => !current)}
        onNavigate={() => setMobileOpen(false)}
      />
      {isMobile && mobileOpen ? (
        <button type="button" className="nav-backdrop" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />
      ) : null}
      <div className="app-shell__main">
        <Header
          title={title}
          breadcrumbs={breadcrumbs}
          menuButtonRef={menuButtonRef}
          mobileNavOpen={mobileOpen}
          onToggleMobileNav={() => setMobileOpen((current) => !current)}
        />
        <main id="main-content" className="app-shell__content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}

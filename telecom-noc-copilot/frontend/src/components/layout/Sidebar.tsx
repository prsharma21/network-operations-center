import { NavLink } from 'react-router-dom'
import { Icon } from '@/components/common/Icon'
import { NAV_ITEMS } from '@/routes/navigation'
import { appConfig, canUseDemoFallback } from '@/utils/config'

function displayApiHost(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

interface SidebarProps {
  collapsed: boolean
  mobileOpen: boolean
  onToggleCollapse: () => void
  onNavigate: () => void
}

export function Sidebar({ collapsed, mobileOpen, onToggleCollapse, onNavigate }: SidebarProps) {
  const classes = ['sidebar', collapsed ? 'sidebar--collapsed' : '', mobileOpen ? 'sidebar--mobile-open' : '']
    .filter(Boolean)
    .join(' ')

  return (
    <aside className={classes} id="primary-navigation" aria-label={appConfig.appTitle}>
      <div className="sidebar__brand">
        <span className="sidebar__mark">
          <Icon name="radar" size={18} />
        </span>
        <span className="sidebar__name">
          <span className="sidebar__product">{appConfig.appTitle}</span>
          <span className="sidebar__tagline">Network operations</span>
        </span>
      </div>

      <p className="sidebar__section-label">Monitor</p>
      <nav className="sidebar__nav" aria-label="Primary">
        <ul>
          {NAV_ITEMS.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                aria-label={item.label}
                title={item.label}
                className={({ isActive }) => `nav-link${isActive ? ' is-active' : ''}`}
                onClick={onNavigate}
              >
                <Icon name={item.icon} />
                <span className="nav-link__label">{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="sidebar__footer">
        <p className="sidebar__footer-text">
          {canUseDemoFallback() ? 'Labeled demo fallback is available. ' : ''}
          No live network changes.
        </p>
        {import.meta.env.DEV ? (
          <p className="sidebar__devmeta" title={appConfig.apiBaseUrl}>
            API {displayApiHost(appConfig.apiBaseUrl)}
            <br />
            Demo fallback {appConfig.useDemoData ? 'on' : 'off'}
          </p>
        ) : null}
        <button
          type="button"
          className="sidebar__collapse"
          aria-expanded={!collapsed}
          aria-controls="primary-navigation"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={onToggleCollapse}
        >
          <Icon name="chevron" />
          <span className="nav-link__label" aria-hidden="true">
            {collapsed ? 'Expand' : 'Collapse'}
          </span>
        </button>
      </div>
    </aside>
  )
}

import type { Breadcrumb, IconName } from '@/types/ui'

export interface NavItem {
  label: string
  to: string
  end?: boolean
  icon: IconName
  description: string
  breadcrumbs: Breadcrumb[]
}

const home: Breadcrumb = { label: 'Network operations', to: '/' }

export const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    to: '/',
    end: true,
    icon: 'dashboard',
    description: 'A simple overview of open alerts, impacted sites, and recent problems.',
    breadcrumbs: [home, { label: 'Dashboard' }],
  },
  {
    label: 'Alerts',
    to: '/alarms',
    icon: 'alarm',
    description: 'Browse alerts from the network. Viewing alerts here does not change the live network.',
    breadcrumbs: [home, { label: 'Alerts' }],
  },
  {
    label: 'Sites',
    to: '/sites',
    icon: 'site',
    description: 'Check one site’s health, alerts, recent software changes, and connection links.',
    breadcrumbs: [home, { label: 'Sites' }],
  },
  {
    label: 'Problems',
    to: '/incidents',
    icon: 'incident',
    description: 'Open a problem, investigate it, and review possible causes. Nothing is confirmed automatically.',
    breadcrumbs: [home, { label: 'Problems' }],
  },
  {
    label: 'Guides',
    to: '/runbooks',
    icon: 'runbook',
    description: 'Search troubleshooting guides for what to check next. Guides are suggestions, not a final cause.',
    breadcrumbs: [home, { label: 'Guides' }],
  },
  {
    label: 'Approvals',
    to: '/approvals',
    icon: 'approval',
    description: 'Review recommended next steps. Approve/reject records a human decision only — it does not change the network.',
    breadcrumbs: [home, { label: 'Approvals' }],
  },
  {
    label: 'Reports',
    to: '/reports',
    icon: 'report',
    description: 'Read investigation reports with the story, evidence, possible causes, and guide steps.',
    breadcrumbs: [home, { label: 'Reports' }],
  },
]

export function getNavItem(to: string): NavItem {
  const item = NAV_ITEMS.find((entry) => entry.to === to)
  if (!item) throw new Error(`Unknown navigation item: ${to}`)
  return item
}

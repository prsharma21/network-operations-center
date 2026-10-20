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
    description: 'Current alarm load, site impact, latency, and recent operational events for this NOC.',
    breadcrumbs: [home, { label: 'Dashboard' }],
  },
  {
    label: 'Alarms',
    to: '/alarms',
    icon: 'alarm',
    description: 'Alarm console for correlated network faults. No alarm feed is connected yet.',
    breadcrumbs: [home, { label: 'Alarms' }],
  },
  {
    label: 'Sites',
    to: '/sites',
    icon: 'site',
    description: 'Site inventory for the monitored footprint. No inventory is connected yet.',
    breadcrumbs: [home, { label: 'Sites' }],
  },
  {
    label: 'Incidents',
    to: '/incidents',
    icon: 'incident',
    description: 'Incident workspace for triage and resolution. No records are loaded yet.',
    breadcrumbs: [home, { label: 'Incidents' }],
  },
  {
    label: 'Runbooks',
    to: '/runbooks',
    icon: 'runbook',
    description: 'Approved procedures for guided remediation. No runbooks are loaded yet.',
    breadcrumbs: [home, { label: 'Runbooks' }],
  },
  {
    label: 'Approvals',
    to: '/approvals',
    icon: 'approval',
    description: 'Human approval queue for simulated remediation. No requests are loaded yet.',
    breadcrumbs: [home, { label: 'Approvals' }],
  },
  {
    label: 'Reports',
    to: '/reports',
    icon: 'report',
    description: 'Shift summaries and operational reports. No reports are available yet.',
    breadcrumbs: [home, { label: 'Reports' }],
  },
]

export function getNavItem(to: string): NavItem {
  const item = NAV_ITEMS.find((entry) => entry.to === to)
  if (!item) throw new Error(`Unknown navigation item: ${to}`)
  return item
}

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
    description: 'Filter and inspect network alarms. Selection is for viewing and grouping only — no live network changes are made here.',
    breadcrumbs: [home, { label: 'Alarms' }],
  },
  {
    label: 'Sites',
    to: '/sites',
    icon: 'site',
    description: 'Inspect a cell site’s health, KPIs, alarms, deployments, and backhaul topology.',
    breadcrumbs: [home, { label: 'Sites' }],
  },
  {
    label: 'Incidents',
    to: '/incidents',
    icon: 'incident',
    description: 'Investigate correlated alarms and evidence. Ranked hypotheses are not verified root causes, and remediation is not executed here.',
    breadcrumbs: [home, { label: 'Incidents' }],
  },
  {
    label: 'Runbooks',
    to: '/runbooks',
    icon: 'runbook',
    description: 'Search indexed troubleshooting documents by symptom, alarm type, technology, KPI, or incident. Passages are source-grounded and are not a confirmed root cause.',
    breadcrumbs: [home, { label: 'Runbooks' }],
  },
  {
    label: 'Approvals',
    to: '/approvals',
    icon: 'approval',
    description: 'Human approval queue for recommended next steps. Approval records a decision only and does not execute a network change.',
    breadcrumbs: [home, { label: 'Approvals' }],
  },
  {
    label: 'Reports',
    to: '/reports',
    icon: 'report',
    description: 'Read-only incident reports with observed facts, AI hypotheses, runbook sources, recommendations, and recorded human decisions. Reports do not execute network changes.',
    breadcrumbs: [home, { label: 'Reports' }],
  },
]

export function getNavItem(to: string): NavItem {
  const item = NAV_ITEMS.find((entry) => entry.to === to)
  if (!item) throw new Error(`Unknown navigation item: ${to}`)
  return item
}

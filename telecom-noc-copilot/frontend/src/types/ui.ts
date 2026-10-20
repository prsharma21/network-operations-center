export type IconName =
  | 'dashboard'
  | 'alarm'
  | 'site'
  | 'incident'
  | 'runbook'
  | 'approval'
  | 'report'
  | 'search'
  | 'bell'
  | 'menu'
  | 'close'
  | 'chevron'
  | 'radar'

export type BadgeTone = 'critical' | 'major' | 'minor' | 'info' | 'neutral' | 'demo'

export type OperationalStatus =
  | 'active'
  | 'inactive'
  | 'open'
  | 'acknowledged'
  | 'in-progress'
  | 'pending'
  | 'resolved'
  | 'cleared'
  | 'approved'
  | 'rejected'
  | 'maintenance'
  | 'healthy'
  | 'degraded'
  | 'critical'
  | 'demo'

export type Severity = 'critical' | 'major' | 'minor' | 'warning' | 'info' | 'cleared'

export interface Breadcrumb {
  label: string
  to?: string
}

export interface RouteHandle {
  title: string
  breadcrumbs: Breadcrumb[]
}

export function isRouteHandle(value: unknown): value is RouteHandle {
  if (typeof value !== 'object' || value === null) return false
  const handle = value as Partial<RouteHandle>
  return typeof handle.title === 'string' && Array.isArray(handle.breadcrumbs)
}

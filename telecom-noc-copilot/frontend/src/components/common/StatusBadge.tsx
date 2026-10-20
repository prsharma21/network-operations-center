import type { BadgeTone, OperationalStatus } from '@/types/ui'

const STATUS_LABELS: Record<OperationalStatus, string> = {
  active: 'Active',
  inactive: 'Inactive',
  open: 'Open',
  acknowledged: 'Acknowledged',
  'in-progress': 'In progress',
  pending: 'Pending',
  deferred: 'Deferred',
  resolved: 'Resolved',
  cleared: 'Cleared',
  approved: 'Approved',
  rejected: 'Rejected',
  maintenance: 'Maintenance',
  healthy: 'Healthy',
  degraded: 'Degraded',
  critical: 'Critical',
  demo: 'Demo data',
}

const STATUS_TONES: Record<OperationalStatus, BadgeTone> = {
  active: 'minor',
  inactive: 'neutral',
  open: 'info',
  acknowledged: 'info',
  'in-progress': 'major',
  pending: 'major',
  deferred: 'info',
  resolved: 'minor',
  cleared: 'minor',
  approved: 'minor',
  rejected: 'critical',
  maintenance: 'neutral',
  healthy: 'minor',
  degraded: 'major',
  critical: 'critical',
  demo: 'demo',
}

interface StatusBadgeProps {
  status: OperationalStatus
  label?: string
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  return (
    <span className={`badge badge--${STATUS_TONES[status]}`}>
      {label ?? STATUS_LABELS[status]}
    </span>
  )
}

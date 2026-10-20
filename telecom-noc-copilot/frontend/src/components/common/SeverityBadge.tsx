import type { BadgeTone, Severity } from '@/types/ui'

const SEVERITY_LABELS: Record<Severity, string> = {
  critical: 'Critical',
  major: 'Major',
  minor: 'Minor',
  warning: 'Warning',
  info: 'Info',
  cleared: 'Cleared',
}

const SEVERITY_TONES: Record<Severity, BadgeTone> = {
  critical: 'critical',
  major: 'major',
  minor: 'minor',
  warning: 'major',
  info: 'info',
  cleared: 'minor',
}

interface SeverityBadgeProps {
  severity: Severity
  label?: string
}

export function SeverityBadge({ severity, label }: SeverityBadgeProps) {
  return (
    <span className={`badge badge--${SEVERITY_TONES[severity]}`}>
      {label ?? SEVERITY_LABELS[severity]}
    </span>
  )
}

import { Link } from 'react-router-dom'

interface KpiCardProps {
  label: string
  value: string
  hint: string
  to: string
  tone?: 'default' | 'critical'
}

export function KpiCard({ label, value, hint, to, tone = 'default' }: KpiCardProps) {
  return (
    <Link to={to} className={`kpi-card${tone === 'critical' ? ' kpi-card--critical' : ''}`}>
      <span className="kpi-card__label">{label}</span>
      <span className="kpi-card__value">{value}</span>
      <span className="kpi-card__hint">{hint}</span>
    </Link>
  )
}

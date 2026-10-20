import type { ReactNode } from 'react'

interface EmptyStateProps {
  title: string
  description?: string
  action?: ReactNode
  compact?: boolean
}

export function EmptyState({ title, description, action, compact = false }: EmptyStateProps) {
  const classes = ['empty-state', compact ? 'empty-state--compact' : ''].filter(Boolean).join(' ')

  return (
    <div className={classes}>
      <h3 className="empty-state__title">{title}</h3>
      {description ? <p className="empty-state__description">{description}</p> : null}
      {action ? <div className="empty-state__action">{action}</div> : null}
    </div>
  )
}

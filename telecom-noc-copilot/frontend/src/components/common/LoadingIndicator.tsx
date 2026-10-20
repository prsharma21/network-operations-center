interface LoadingIndicatorProps {
  label?: string
  size?: 'sm' | 'md'
}

export function LoadingIndicator({ label = 'Loading', size = 'md' }: LoadingIndicatorProps) {
  return (
    <div className={`loading loading--${size}`} role="status">
      <span className="loading__spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}

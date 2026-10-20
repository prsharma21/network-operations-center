import type { ReactNode } from 'react'

interface ErrorMessageProps {
  title: string
  message: string
  action?: ReactNode
}

export function ErrorMessage({ title, message, action }: ErrorMessageProps) {
  return (
    <div className="error-message" role="alert">
      <h2 className="error-message__title">{title}</h2>
      <p>{message}</p>
      {action ? <div className="error-message__action">{action}</div> : null}
    </div>
  )
}

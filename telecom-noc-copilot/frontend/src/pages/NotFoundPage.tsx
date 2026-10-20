import { Link } from 'react-router-dom'
import { ErrorMessage } from '@/components/common/ErrorMessage'

export function NotFoundPage() {
  return (
    <div className="page">
      <ErrorMessage
        title="Page not found"
        message="That view is not part of Telecom NOC Copilot."
        action={
          <Link className="btn btn--secondary" to="/">
            Back to dashboard
          </Link>
        }
      />
    </div>
  )
}

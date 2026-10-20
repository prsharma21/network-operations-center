import { Link, useParams } from 'react-router-dom'
import { Card } from '@/components/common/Card'
import { EmptyState } from '@/components/common/EmptyState'
import { PageHeader } from '@/components/common/PageHeader'

export function IncidentDetailPage() {
  const { incidentId } = useParams()
  const title = incidentId ?? 'Incident'

  return (
    <div className="page">
      <PageHeader
        title={title}
        description="Incident investigation is not available yet. This route exists so dashboard incidents have a detail target."
      />
      <Card>
        <EmptyState
          title="Incident detail is not implemented"
          description="The Network Health Dashboard can open this page, but evidence, runbooks, and approval actions will be added later. No network changes can be made from here."
          action={
            <Link className="btn btn--secondary" to="/incidents">
              Back to incidents
            </Link>
          }
        />
      </Card>
    </div>
  )
}

import { Card } from '@/components/common/Card'
import { EmptyState } from '@/components/common/EmptyState'
import { PageHeader } from '@/components/common/PageHeader'

interface PlaceholderPageProps {
  title: string
  description: string
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className="page">
      <PageHeader title={title} description={description} />
      <Card>
        <EmptyState
          title="Nothing to show yet"
          description="This screen is a placeholder in the demo shell. Operational data and workflows will be added later. No network changes can be made from here."
        />
      </Card>
    </div>
  )
}

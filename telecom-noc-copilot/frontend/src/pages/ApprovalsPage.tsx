import { PlaceholderPage } from '@/pages/PlaceholderPage'
import { getNavItem } from '@/routes/navigation'

const page = getNavItem('/approvals')

export function ApprovalsPage() {
  return <PlaceholderPage title={page.label} description={page.description} />
}

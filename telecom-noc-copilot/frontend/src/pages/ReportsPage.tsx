import { PlaceholderPage } from '@/pages/PlaceholderPage'
import { getNavItem } from '@/routes/navigation'

const page = getNavItem('/reports')

export function ReportsPage() {
  return <PlaceholderPage title={page.label} description={page.description} />
}

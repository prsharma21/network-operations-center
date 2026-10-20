import { PlaceholderPage } from '@/pages/PlaceholderPage'
import { getNavItem } from '@/routes/navigation'

const page = getNavItem('/sites')

export function SitesPage() {
  return <PlaceholderPage title={page.label} description={page.description} />
}

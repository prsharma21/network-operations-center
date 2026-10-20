import { PlaceholderPage } from '@/pages/PlaceholderPage'
import { getNavItem } from '@/routes/navigation'

const page = getNavItem('/runbooks')

export function RunbooksPage() {
  return <PlaceholderPage title={page.label} description={page.description} />
}

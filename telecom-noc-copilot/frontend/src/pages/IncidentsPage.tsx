import { PlaceholderPage } from '@/pages/PlaceholderPage'
import { getNavItem } from '@/routes/navigation'

const page = getNavItem('/incidents')

export function IncidentsPage() {
  return <PlaceholderPage title={page.label} description={page.description} />
}

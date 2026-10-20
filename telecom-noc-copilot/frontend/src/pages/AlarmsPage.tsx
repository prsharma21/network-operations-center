import { PlaceholderPage } from '@/pages/PlaceholderPage'
import { getNavItem } from '@/routes/navigation'

const page = getNavItem('/alarms')

export function AlarmsPage() {
  return <PlaceholderPage title={page.label} description={page.description} />
}

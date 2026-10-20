import { createBrowserRouter } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { AlarmsPage } from '@/pages/AlarmsPage'
import { ApprovalsPage } from '@/pages/ApprovalsPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { IncidentDetailPage } from '@/pages/IncidentDetailPage'
import { IncidentsPage } from '@/pages/IncidentsPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { ReportsPage } from '@/pages/ReportsPage'
import { RunbooksPage } from '@/pages/RunbooksPage'
import { SitesPage } from '@/pages/SitesPage'
import { getNavItem } from '@/routes/navigation'
import type { RouteHandle } from '@/types/ui'

function handleFor(path: string): RouteHandle {
  const item = getNavItem(path)
  return { title: item.label, breadcrumbs: item.breadcrumbs }
}

const notFoundHandle: RouteHandle = {
  title: 'Page not found',
  breadcrumbs: [
    { label: 'Network operations', to: '/' },
    { label: 'Page not found' },
  ],
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <DashboardPage />, handle: handleFor('/') },
      { path: 'alarms', element: <AlarmsPage />, handle: handleFor('/alarms') },
      { path: 'sites', element: <SitesPage />, handle: handleFor('/sites') },
      {
        path: 'sites/:siteId',
        element: <SitesPage />,
        handle: {
          title: 'Site health',
          breadcrumbs: [
            { label: 'Network operations', to: '/' },
            { label: 'Sites', to: '/sites' },
            { label: 'Site health' },
          ],
        },
      },
      { path: 'incidents', element: <IncidentsPage />, handle: handleFor('/incidents') },
      {
        path: 'incidents/:incidentId',
        element: <IncidentDetailPage />,
        handle: {
          title: 'Incident',
          breadcrumbs: [
            { label: 'Network operations', to: '/' },
            { label: 'Incidents', to: '/incidents' },
            { label: 'Incident' },
          ],
        },
      },
      { path: 'runbooks', element: <RunbooksPage />, handle: handleFor('/runbooks') },
      { path: 'approvals', element: <ApprovalsPage />, handle: handleFor('/approvals') },
      { path: 'reports', element: <ReportsPage />, handle: handleFor('/reports') },
      { path: '*', element: <NotFoundPage />, handle: notFoundHandle },
    ],
  },
])

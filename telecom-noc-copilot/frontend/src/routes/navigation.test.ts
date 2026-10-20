import { describe, expect, it } from 'vitest'
import { NAV_ITEMS, getNavItem } from '@/routes/navigation'

describe('navigation', () => {
  it('covers Dashboard, Alarms, Sites, Incidents, Runbooks, Approvals, and Reports', () => {
    expect(NAV_ITEMS.map((item) => item.to)).toEqual([
      '/',
      '/alarms',
      '/sites',
      '/incidents',
      '/runbooks',
      '/approvals',
      '/reports',
    ])
  })

  it('resolves breadcrumb handles for each primary route', () => {
    for (const item of NAV_ITEMS) {
      expect(getNavItem(item.to).label).toBe(item.label)
      expect(item.breadcrumbs.at(-1)?.label).toBe(item.label)
    }
  })
})

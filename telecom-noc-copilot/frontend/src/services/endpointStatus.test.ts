import { beforeEach, describe, expect, it } from 'vitest'
import { ApiError } from '@/services/httpClient'
import {
  rememberInfrastructureGap,
  resetMissingRoutes,
  routeTemplate,
  shouldSkipUnreachableRoute,
} from '@/services/endpointStatus'

describe('endpointStatus', () => {
  beforeEach(() => {
    resetMissingRoutes()
  })

  it('templates incident, alarm, and site ids', () => {
    expect(routeTemplate('/incidents/INC-OUTAGE-001/investigate')).toBe('/incidents/{incident_id}/investigate')
    expect(routeTemplate('/alarms/ALM-0001')).toBe('/alarms/{alarm_id}')
    expect(routeTemplate('/sites/SITE-003/metrics')).toBe('/sites/{site_id}/metrics')
  })

  it('remembers timeouts and 501s, not resource 404s', () => {
    const path = '/incidents/INC-UNIQUE-SKIP/approve'
    rememberInfrastructureGap(path, new ApiError('not found', 404, path))
    expect(shouldSkipUnreachableRoute(path)).toBe(false)

    rememberInfrastructureGap(path, new ApiError('timeout', 0, path))
    expect(shouldSkipUnreachableRoute('/incidents/INC-OTHER/approve')).toBe(true)
    expect(shouldSkipUnreachableRoute('/incidents/INC-OTHER/investigate')).toBe(false)
  })
})

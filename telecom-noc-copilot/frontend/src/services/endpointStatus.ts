import { ApiError } from '@/services/httpClient'

const missingRoutes = new Set<string>()

export function routeTemplate(path: string): string {
  return path
    .replace(/\/incidents\/[^/]+/g, '/incidents/{incident_id}')
    .replace(/\/alarms\/[^/]+/g, '/alarms/{alarm_id}')
    .replace(/\/sites\/[^/]+/g, '/sites/{site_id}')
}

export function rememberInfrastructureGap(path: string, error: unknown): void {
  if (!(error instanceof ApiError)) return
  if (error.status === 0 || error.status === 501) {
    missingRoutes.add(routeTemplate(path))
  }
}

export function shouldSkipUnreachableRoute(path: string): boolean {
  return missingRoutes.has(routeTemplate(path))
}

export function resetMissingRoutes(): void {
  missingRoutes.clear()
}

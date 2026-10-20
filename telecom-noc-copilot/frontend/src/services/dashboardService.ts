import { buildDemoDashboard } from '@/services/demo/dashboardDemo'
import { ApiError, apiGet, isMissingEndpoint } from '@/services/httpClient'
import type { DashboardSummary, TimeRange } from '@/types/dashboard'
import { appConfig } from '@/utils/config'

/**
 * FastAPI contract used by the Network Health Dashboard.
 * This endpoint is not implemented in the current backend scaffold.
 * GET /api/v1/dashboard/summary?range=1h|24h|7d
 */
export const DASHBOARD_SUMMARY_ENDPOINT = '/api/v1/dashboard/summary'

function canUseDemoFallback(): boolean {
  return import.meta.env.DEV || appConfig.useDemoData
}

function isDashboardSummary(value: unknown): value is DashboardSummary {
  if (typeof value !== 'object' || value === null) return false
  const summary = value as Partial<DashboardSummary>
  return Boolean(summary.kpis && Array.isArray(summary.trends) && Array.isArray(summary.regionalHealth))
}

export async function getDashboardSummary(range: TimeRange, signal?: AbortSignal): Promise<DashboardSummary> {
  try {
    const payload = await apiGet<unknown>(DASHBOARD_SUMMARY_ENDPOINT, {
      query: { range },
      signal,
    })
    if (!isDashboardSummary(payload)) {
      throw new ApiError('FastAPI dashboard summary payload was not recognized', 502, DASHBOARD_SUMMARY_ENDPOINT)
    }
    return {
      ...payload,
      range,
      source: 'api',
    }
  } catch (error) {
    if (canUseDemoFallback() && isMissingEndpoint(error)) {
      return {
        ...buildDemoDashboard(range),
        missingEndpoint: DASHBOARD_SUMMARY_ENDPOINT,
      }
    }
    throw error
  }
}

import { ALARMS_ENDPOINT } from '@/services/alarmService'
import { buildDemoSiteHealth, listDemoSites } from '@/services/demo/siteDemo'
import { ApiError, apiGet, isMissingEndpoint } from '@/services/httpClient'
import { isRecord, readString, unwrapList } from '@/services/jsonParse'
import type { TimeRange } from '@/types/dashboard'
import type { SiteCatalogItem, SiteHealth } from '@/types/site'
import type { OperationalStatus } from '@/types/ui'
import { canUseDemoFallback } from '@/utils/config'

/**
 * FastAPI contracts used by Site Health. None of these are implemented in the
 * current backend scaffold.
 *
 * GET /sites
 * GET /sites/{site_id}
 * GET /sites/{site_id}/metrics?range=1h|24h|7d
 * GET /alarms?site_id={site_id}
 * GET /deployments?site_id={site_id}
 */
export const SITE_COLLECTION_ENDPOINT = '/sites'
export const siteDetailEndpoint = (siteId: string) => `/sites/${siteId}`
export const siteMetricsEndpoint = (siteId: string) => `/sites/${siteId}/metrics`
export const DEPLOYMENTS_ENDPOINT = '/deployments'

function normalizeCatalogItem(value: unknown): SiteCatalogItem | null {
  if (!isRecord(value)) return null
  const siteId = readString(value, 'siteId', 'site_id')
  if (!siteId) return null
  return {
    siteId,
    siteName: readString(value, 'siteName', 'site_name') ?? siteId,
    region: readString(value, 'region') ?? '—',
    technology: readString(value, 'technology') ?? '—',
    vendor: readString(value, 'vendor') ?? '—',
    status: (readString(value, 'status') ?? 'healthy') as OperationalStatus,
    impacted: value.impacted === true || value.impacted === 'true',
  }
}

export async function getSiteCatalog(signal?: AbortSignal): Promise<SiteCatalogItem[]> {
  try {
    const payload = await apiGet<unknown>(SITE_COLLECTION_ENDPOINT, { signal })
    const rows = unwrapList(payload, 'sites', 'items')
    const items = rows.map(normalizeCatalogItem).filter((item): item is SiteCatalogItem => Boolean(item))
    if (items.length === 0 && rows.length > 0) {
      throw new ApiError('FastAPI site list payload was not recognized', 502, SITE_COLLECTION_ENDPOINT)
    }
    return items
  } catch (error) {
    if (canUseDemoFallback() && isMissingEndpoint(error)) {
      return listDemoSites()
    }
    throw error
  }
}

export async function getSiteHealth(siteId: string, range: TimeRange, signal?: AbortSignal): Promise<SiteHealth> {
  const missingEndpoints: string[] = []
  const detailPath = siteDetailEndpoint(siteId)
  const metricsPath = siteMetricsEndpoint(siteId)

  try {
    const site = await apiGet<SiteHealth>(detailPath, { signal })
    try {
      const metrics = await apiGet<{ trends?: SiteHealth['trends'] }>(metricsPath, {
        query: { range },
        signal,
      })
      return {
        ...site,
        range,
        trends: metrics.trends ?? site.trends,
        source: 'api',
        missingEndpoints,
      }
    } catch (metricsError) {
      if (!(canUseDemoFallback() && isMissingEndpoint(metricsError))) throw metricsError
      const demo = buildDemoSiteHealth(siteId, range)
      return {
        ...site,
        range,
        trends: demo.trends,
        kpis: demo.kpis,
        asOf: demo.asOf,
        source: 'demo',
        missingEndpoints: [metricsPath],
      }
    }
  } catch (error) {
    if (!(canUseDemoFallback() && isMissingEndpoint(error))) throw error
    missingEndpoints.push(detailPath, metricsPath, `${ALARMS_ENDPOINT}?site_id=`, `${DEPLOYMENTS_ENDPOINT}?site_id=`)
    try {
      return {
        ...buildDemoSiteHealth(siteId, range),
        missingEndpoints,
      }
    } catch {
      throw new ApiError(`Site ${siteId} was not found`, 404, detailPath)
    }
  }
}

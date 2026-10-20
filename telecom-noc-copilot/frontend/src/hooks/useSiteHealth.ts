import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '@/services/httpClient'
import { getSiteHealth } from '@/services/siteService'
import type { TimeRange } from '@/types/dashboard'
import type { SiteHealth } from '@/types/site'

interface SiteHealthState {
  data: SiteHealth | null
  loading: boolean
  error: string | null
  reload: () => void
}

export function useSiteHealth(siteId: string | null, range: TimeRange): SiteHealthState {
  const [data, setData] = useState<SiteHealth | null>(null)
  const [loading, setLoading] = useState(Boolean(siteId))
  const [error, setError] = useState<string | null>(null)
  const [requestId, setRequestId] = useState(0)

  const reload = useCallback(() => setRequestId((current) => current + 1), [])

  useEffect(() => {
    if (!siteId) {
      setData(null)
      setError(null)
      setLoading(false)
      return
    }

    const controller = new AbortController()
    setLoading(true)
    setError(null)

    getSiteHealth(siteId, range, controller.signal)
      .then((health) => {
        if (!controller.signal.aborted) setData(health)
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted || (reason instanceof DOMException && reason.name === 'AbortError')) return
        setData(null)
        setError(reason instanceof ApiError ? reason.message : 'Site health could not be loaded.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [siteId, range, requestId])

  return { data, loading, error, reload }
}

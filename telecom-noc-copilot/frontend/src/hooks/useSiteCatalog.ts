import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '@/services/httpClient'
import { getSiteCatalog } from '@/services/siteService'
import type { SiteCatalogItem } from '@/types/site'

interface CatalogState {
  sites: SiteCatalogItem[]
  loading: boolean
  error: string | null
  reload: () => void
}

export function useSiteCatalog(): CatalogState {
  const [sites, setSites] = useState<SiteCatalogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [requestId, setRequestId] = useState(0)

  const reload = useCallback(() => setRequestId((current) => current + 1), [])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)

    getSiteCatalog(controller.signal)
      .then((items) => {
        if (!controller.signal.aborted) setSites(items)
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted || (reason instanceof DOMException && reason.name === 'AbortError')) return
        setSites([])
        setError(reason instanceof ApiError ? reason.message : 'The site catalog could not be loaded.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [requestId])

  return { sites, loading, error, reload }
}

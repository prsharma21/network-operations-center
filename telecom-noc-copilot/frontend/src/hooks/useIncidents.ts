import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '@/services/httpClient'
import { listIncidents, type IncidentListResult } from '@/services/incidentService'
import type { IncidentListItem } from '@/types/incident'

interface IncidentsState {
  items: IncidentListItem[]
  source: IncidentListResult['source'] | null
  asOf: string | null
  missingEndpoints: string[]
  loading: boolean
  error: string | null
  reload: () => void
}

export function useIncidents(filters: { status?: string; siteId?: string }): IncidentsState {
  const [items, setItems] = useState<IncidentListItem[]>([])
  const [source, setSource] = useState<IncidentListResult['source'] | null>(null)
  const [asOf, setAsOf] = useState<string | null>(null)
  const [missingEndpoints, setMissingEndpoints] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [requestId, setRequestId] = useState(0)

  const reload = useCallback(() => setRequestId((current) => current + 1), [])
  const status = filters.status
  const siteId = filters.siteId

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)

    listIncidents({ status, siteId }, controller.signal)
      .then((next) => {
        if (controller.signal.aborted) return
        setItems(next.items)
        setSource(next.source)
        setAsOf(next.asOf)
        setMissingEndpoints(next.missingEndpoints)
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted || (reason instanceof DOMException && reason.name === 'AbortError')) return
        setItems([])
        setSource(null)
        setAsOf(null)
        setMissingEndpoints([])
        setError(reason instanceof ApiError ? reason.message : 'Incidents could not be loaded.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [status, siteId, requestId])

  return { items, source, asOf, missingEndpoints, loading, error, reload }
}

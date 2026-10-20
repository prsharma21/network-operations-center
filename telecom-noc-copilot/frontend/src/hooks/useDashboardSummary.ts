import { useCallback, useEffect, useState } from 'react'
import { getDashboardSummary } from '@/services/dashboardService'
import { ApiError } from '@/services/httpClient'
import type { DashboardSummary, TimeRange } from '@/types/dashboard'

interface DashboardState {
  data: DashboardSummary | null
  loading: boolean
  error: string | null
  reload: () => void
}

export function useDashboardSummary(range: TimeRange): DashboardState {
  const [data, setData] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [requestId, setRequestId] = useState(0)

  const reload = useCallback(() => {
    setRequestId((current) => current + 1)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)

    getDashboardSummary(range, controller.signal)
      .then((summary) => {
        if (controller.signal.aborted) return
        setData(summary)
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted || (reason instanceof DOMException && reason.name === 'AbortError')) return
        const message = reason instanceof ApiError
          ? reason.message
          : 'The dashboard could not load network health data.'
        setData(null)
        setError(message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [range, requestId])

  return { data, loading, error, reload }
}

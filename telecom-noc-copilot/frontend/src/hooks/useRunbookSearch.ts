import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '@/services/httpClient'
import { searchRunbooks } from '@/services/runbookService'
import type { RunbookSearchQuery, RunbookSearchResult } from '@/types/runbook'

interface RunbookSearchState {
  data: RunbookSearchResult | null
  loading: boolean
  error: string | null
  searched: boolean
  reload: () => void
}

export function useRunbookSearch(query: RunbookSearchQuery, enabled: boolean): RunbookSearchState {
  const [data, setData] = useState<RunbookSearchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)
  const [requestId, setRequestId] = useState(0)

  const reload = useCallback(() => setRequestId((current) => current + 1), [])
  const queryKey = JSON.stringify(query)

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }

    const parsed = JSON.parse(queryKey) as RunbookSearchQuery
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    setSearched(true)

    searchRunbooks(parsed, { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) setData(result)
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted || (reason instanceof DOMException && reason.name === 'AbortError')) return
        setData(null)
        setError(reason instanceof ApiError ? reason.message : 'Runbook search could not be completed.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [enabled, queryKey, requestId])

  return { data, loading, error, searched, reload }
}

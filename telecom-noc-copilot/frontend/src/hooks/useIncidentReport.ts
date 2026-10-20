import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '@/services/httpClient'
import { getIncidentReport, listIncidentReports } from '@/services/reportService'
import type { IncidentReport, ReportCatalogResult } from '@/types/report'

interface ReportState {
  data: IncidentReport | null
  loading: boolean
  error: string | null
  notFound: boolean
  reload: () => void
}

export function useIncidentReport(incidentId: string | null, reportId?: string | null): ReportState {
  const [data, setData] = useState<IncidentReport | null>(null)
  const [loading, setLoading] = useState(Boolean(incidentId))
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [requestId, setRequestId] = useState(0)

  const reload = useCallback(() => setRequestId((current) => current + 1), [])

  useEffect(() => {
    if (!incidentId) {
      setData(null)
      setError(null)
      setNotFound(false)
      setLoading(false)
      return
    }

    const controller = new AbortController()
    setLoading(true)
    setError(null)
    setNotFound(false)

    getIncidentReport(incidentId, { reportId: reportId ?? undefined, signal: controller.signal })
      .then((report) => {
        if (!controller.signal.aborted) setData(report)
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted || (reason instanceof DOMException && reason.name === 'AbortError')) return
        setData(null)
        if (reason instanceof ApiError && reason.status === 404) {
          setNotFound(true)
          setError(reason.message)
        } else {
          setNotFound(false)
          setError(reason instanceof ApiError ? reason.message : 'The incident report could not be loaded.')
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [incidentId, reportId, requestId])

  return { data, loading, error, notFound, reload }
}

interface CatalogState {
  data: ReportCatalogResult | null
  loading: boolean
  error: string | null
  reload: () => void
}

export function useReportCatalog(enabled: boolean): CatalogState {
  const [data, setData] = useState<ReportCatalogResult | null>(null)
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)
  const [requestId, setRequestId] = useState(0)

  const reload = useCallback(() => setRequestId((current) => current + 1), [])

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }

    const controller = new AbortController()
    setLoading(true)
    setError(null)

    listIncidentReports(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setData(result)
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted || (reason instanceof DOMException && reason.name === 'AbortError')) return
        setData(null)
        setError(reason instanceof ApiError ? reason.message : 'Incident reports could not be loaded.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [enabled, requestId])

  return { data, loading, error, reload }
}

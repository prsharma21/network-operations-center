import { useCallback, useEffect, useState } from 'react'
import { getAlarmDetail, listAlarms } from '@/services/alarmService'
import { ApiError } from '@/services/httpClient'
import type { AlarmDetail, AlarmListResult, AlarmQuery } from '@/types/alarm'

interface AlarmsState {
  data: AlarmListResult | null
  loading: boolean
  error: string | null
  reload: () => void
}

export function useAlarms(query: AlarmQuery): AlarmsState {
  const [data, setData] = useState<AlarmListResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [requestId, setRequestId] = useState(0)

  const reload = useCallback(() => setRequestId((current) => current + 1), [])
  const queryKey = JSON.stringify(query)

  useEffect(() => {
    const parsed = JSON.parse(queryKey) as AlarmQuery
    const controller = new AbortController()
    setLoading(true)
    setError(null)

    listAlarms(parsed, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setData(result)
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted || (reason instanceof DOMException && reason.name === 'AbortError')) return
        setData(null)
        setError(reason instanceof ApiError ? reason.message : 'Alarms could not be loaded.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [queryKey, requestId])

  return { data, loading, error, reload }
}

interface AlarmDetailState {
  detail: AlarmDetail | null
  loading: boolean
  error: string | null
}

export function useAlarmDetail(alarmId: string | null): AlarmDetailState {
  const [detail, setDetail] = useState<AlarmDetail | null>(null)
  const [loading, setLoading] = useState(Boolean(alarmId))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!alarmId) {
      setDetail(null)
      setError(null)
      setLoading(false)
      return
    }

    const controller = new AbortController()
    setLoading(true)
    setError(null)

    getAlarmDetail(alarmId, { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) setDetail(result)
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted || (reason instanceof DOMException && reason.name === 'AbortError')) return
        setDetail(null)
        setError(reason instanceof ApiError ? reason.message : 'Alarm detail could not be loaded.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [alarmId])

  return { detail, loading, error }
}

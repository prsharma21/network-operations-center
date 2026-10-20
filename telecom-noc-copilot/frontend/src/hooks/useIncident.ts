import { useCallback, useEffect, useRef, useState } from 'react'
import { submitApproval } from '@/services/approvalService'
import { ApiError } from '@/services/httpClient'
import { getIncident, investigateIncident, retrieveIncidentRunbooks } from '@/services/incidentService'
import type { ApprovalDecision } from '@/types/approval'
import { isTerminalApproval, upsertApprovalTimeline } from '@/types/approval'
import type { IncidentInvestigation } from '@/types/incident'

interface IncidentState {
  data: IncidentInvestigation | null
  loading: boolean
  investigating: boolean
  retrievingRunbooks: boolean
  submittingApproval: boolean
  error: string | null
  runbookError: string | null
  approvalError: string | null
  reload: () => void
  investigate: () => Promise<void>
  retrieveRunbooks: () => Promise<void>
  approve: (decision: ApprovalDecision, comment: string) => Promise<boolean>
}

export function useIncident(incidentId: string | undefined): IncidentState {
  const [data, setData] = useState<IncidentInvestigation | null>(null)
  const [loading, setLoading] = useState(Boolean(incidentId))
  const [investigating, setInvestigating] = useState(false)
  const [retrievingRunbooks, setRetrievingRunbooks] = useState(false)
  const [submittingApproval, setSubmittingApproval] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [runbookError, setRunbookError] = useState<string | null>(null)
  const [approvalError, setApprovalError] = useState<string | null>(null)
  const [requestId, setRequestId] = useState(0)
  const investigatingRef = useRef(false)
  const approvingRef = useRef(false)

  const reload = useCallback(() => setRequestId((current) => current + 1), [])

  useEffect(() => {
    if (!incidentId) {
      setData(null)
      setError(null)
      setLoading(false)
      return
    }

    const controller = new AbortController()
    setLoading(true)
    setError(null)
    setApprovalError(null)

    getIncident(incidentId, controller.signal)
      .then((incident) => {
        if (!controller.signal.aborted) setData(incident)
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted || (reason instanceof DOMException && reason.name === 'AbortError')) return
        setData(null)
        setError(reason instanceof ApiError ? reason.message : 'Incident could not be loaded.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [incidentId, requestId])

  const investigate = useCallback(async () => {
    if (!incidentId || investigatingRef.current) return
    investigatingRef.current = true
    setInvestigating(true)
    setData((current) => (
      current
        ? { ...current, investigationStatus: 'in_progress', investigationError: null }
        : current
    ))

    try {
      const result = await investigateIncident(incidentId)
      setData(result)
    } catch (reason: unknown) {
      const message = reason instanceof ApiError ? reason.message : 'Investigation failed.'
      setData((current) => (
        current
          ? { ...current, investigationStatus: 'failed', investigationError: message }
          : current
      ))
    } finally {
      investigatingRef.current = false
      setInvestigating(false)
    }
  }, [incidentId])

  const retrieveRunbooks = useCallback(async () => {
    if (!data || retrievingRunbooks) return
    setRetrievingRunbooks(true)
    setRunbookError(null)
    try {
      const next = await retrieveIncidentRunbooks(data)
      setData(next)
    } catch (reason: unknown) {
      const message = reason instanceof ApiError ? reason.message : 'Runbook retrieval failed.'
      setRunbookError(message)
      setData((current) => (
        current ? { ...current, runbookRetrieval: 'failed' } : current
      ))
    } finally {
      setRetrievingRunbooks(false)
    }
  }, [data, retrievingRunbooks])

  const approve = useCallback(async (decision: ApprovalDecision, comment: string) => {
    if (!incidentId || !data?.recommendation || approvingRef.current) return false
    if (isTerminalApproval(data.recommendation.status)) return false
    approvingRef.current = true
    setSubmittingApproval(true)
    setApprovalError(null)
    try {
      const result = await submitApproval(incidentId, { decision, comment }, {
        current: data.recommendation,
      })
      setData((current) => {
        if (result.investigation) return result.investigation
        if (!current) return current
        return {
          ...current,
          recommendation: result.approval,
          timeline: upsertApprovalTimeline(current.timeline, result.approval),
        }
      })
      return true
    } catch (reason: unknown) {
      setApprovalError(reason instanceof ApiError ? reason.message : 'The approval decision could not be recorded.')
      return false
    } finally {
      approvingRef.current = false
      setSubmittingApproval(false)
    }
  }, [data, incidentId])

  return {
    data,
    loading,
    investigating,
    retrievingRunbooks,
    submittingApproval,
    error,
    runbookError,
    approvalError,
    reload,
    investigate,
    retrieveRunbooks,
    approve,
  }
}

import { useCallback, useEffect, useRef, useState } from 'react'
import { listApprovals, submitApproval } from '@/services/approvalService'
import { ApiError } from '@/services/httpClient'
import type { ApprovalDecision, ApprovalListResult, ApprovalRequest, ApprovalStatus } from '@/types/approval'
import { isTerminalApproval } from '@/types/approval'

interface ApprovalsState {
  data: ApprovalListResult | null
  loading: boolean
  error: string | null
  submittingId: string | null
  submitError: { incidentId: string; message: string } | null
  reload: () => void
  submit: (item: ApprovalRequest, decision: ApprovalDecision, comment: string) => Promise<boolean>
}

export function useApprovals(status?: ApprovalStatus): ApprovalsState {
  const [data, setData] = useState<ApprovalListResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submittingId, setSubmittingId] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<{ incidentId: string; message: string } | null>(null)
  const [requestId, setRequestId] = useState(0)
  const submittingRef = useRef<string | null>(null)

  const reload = useCallback(() => setRequestId((current) => current + 1), [])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    setSubmitError(null)

    listApprovals({ status }, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setData(result)
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted || (reason instanceof DOMException && reason.name === 'AbortError')) return
        setData(null)
        setError(reason instanceof ApiError ? reason.message : 'Approvals could not be loaded.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [status, requestId])

  const submit = useCallback(async (item: ApprovalRequest, decision: ApprovalDecision, comment: string) => {
    if (submittingRef.current || isTerminalApproval(item.status)) return false
    submittingRef.current = item.incidentId
    setSubmittingId(item.incidentId)
    setSubmitError(null)
    try {
      const result = await submitApproval(item.incidentId, { decision, comment }, {
        current: item,
      })
      setData((current) => {
        if (!current) return current
        const items = current.items.map((entry) => (
          entry.incidentId === result.approval.incidentId ? result.approval : entry
        ))
        const filtered = status ? items.filter((entry) => entry.status === status) : items
        return { ...current, items: filtered }
      })
      return true
    } catch (reason: unknown) {
      setSubmitError({
        incidentId: item.incidentId,
        message: reason instanceof ApiError ? reason.message : 'The approval decision could not be recorded.',
      })
      return false
    } finally {
      submittingRef.current = null
      setSubmittingId(null)
    }
  }, [data?.source, status])

  return { data, loading, error, submittingId, submitError, reload, submit }
}

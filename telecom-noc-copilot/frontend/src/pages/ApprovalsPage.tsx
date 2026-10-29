import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ApprovalQueue } from '@/components/approvals/ApprovalQueue'
import { Button } from '@/components/common/Button'
import { ErrorMessage } from '@/components/common/ErrorMessage'
import { LoadingIndicator } from '@/components/common/LoadingIndicator'
import { PageHeader } from '@/components/common/PageHeader'
import { useApprovals } from '@/hooks/useApprovals'
import { getNavItem } from '@/routes/navigation'
import { APPROVAL_STATUS_FILTERS, type ApprovalStatus } from '@/types/approval'

const page = getNavItem('/approvals')

function readStatus(value: string | null): ApprovalStatus | undefined {
  if (value === 'pending' || value === 'approved' || value === 'rejected' || value === 'deferred') return value
  return undefined
}

export function ApprovalsPage() {
  const [params, setParams] = useSearchParams()
  const status = readStatus(params.get('status'))
  const { data, loading, error, submittingId, submitError, reload, submit } = useApprovals(status)
  const counts = useMemo(() => {
    const items = data?.items ?? []
    return {
      all: items.length,
      pending: items.filter((item) => item.status === 'pending').length,
    }
  }, [data?.items])

  return (
    <div className="page">
      <PageHeader
        title="Recommendations and approvals"
        description={page.description}
        actions={<Button variant="secondary" onClick={reload}>Refresh</Button>}
      />

      {loading ? (
        <div className="dashboard-state">
          <LoadingIndicator label="Loading approval queue" />
        </div>
      ) : null}

      {error ? (
        <ErrorMessage
          title="Approvals unavailable"
          message={error}
          action={<Button variant="secondary" onClick={reload}>Retry</Button>}
        />
      ) : null}

      {!loading && !error ? (
        <>
          <div className="alarm-filters">
            <label className="alarm-filters__field">
              <span>Status</span>
              <select
                value={status ?? 'all'}
                onChange={(event) => {
                  const next = new URLSearchParams(params)
                  if (event.target.value === 'all') next.delete('status')
                  else next.set('status', event.target.value)
                  setParams(next, { replace: true })
                }}
              >
                {APPROVAL_STATUS_FILTERS.map((option) => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
            </label>
            <p className="filter-notice">
              {counts.all} request{counts.all === 1 ? '' : 's'} in this view
              {status ? '' : ` · ${counts.pending} pending`}.
              Decisions are audit records only.
            </p>
          </div>

          <ApprovalQueue
            items={data?.items ?? []}
            submittingId={submittingId}
            submitError={submitError}
            onDecide={submit}
          />
        </>
      ) : null}
    </div>
  )
}

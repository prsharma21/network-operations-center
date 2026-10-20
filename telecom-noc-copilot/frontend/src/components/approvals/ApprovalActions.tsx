import { useState } from 'react'
import { Button } from '@/components/common/Button'
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog'
import { ErrorMessage } from '@/components/common/ErrorMessage'
import type { ApprovalDecision, ApprovalRequest } from '@/types/approval'
import { commentRequiredFor, decisionLabel, isTerminalApproval } from '@/types/approval'

const SAFETY_COPY = 'This records a human decision only. It does not execute a network change. Authorization is enforced by the backend — a disabled button is not a security control.'

interface ApprovalActionsProps {
  request: ApprovalRequest
  submitting: boolean
  error: string | null
  onDecide: (decision: ApprovalDecision, comment: string) => Promise<boolean>
}

export function ApprovalActions({ request, submitting, error, onDecide }: ApprovalActionsProps) {
  const [pending, setPending] = useState<ApprovalDecision | null>(null)
  const [comment, setComment] = useState('')
  const locked = isTerminalApproval(request.status) || submitting

  const close = () => {
    if (submitting) return
    setPending(null)
    setComment('')
  }

  const confirm = async () => {
    if (!pending || submitting) return
    if (commentRequiredFor(pending) && !comment.trim()) return
    const recorded = await onDecide(pending, comment)
    if (recorded) {
      setPending(null)
      setComment('')
    }
  }

  return (
    <div className="approval-actions">
      <p className="approval-actions__safety" role="note">{SAFETY_COPY}</p>

      {isTerminalApproval(request.status) ? (
        <p className="approval-actions__recorded" role="status">
          Decision recorded as {request.status}. Further submissions are blocked for this recommendation.
        </p>
      ) : (
        <div className="approval-actions__buttons">
          <Button
            onClick={() => { setPending('approve'); setComment('') }}
            disabled={locked}
          >
            Approve
          </Button>
          <Button
            variant="danger"
            onClick={() => { setPending('reject'); setComment('') }}
            disabled={locked}
          >
            Reject
          </Button>
          <Button
            variant="secondary"
            onClick={() => { setPending('defer'); setComment('') }}
            disabled={locked || request.status === 'deferred'}
          >
            Defer
          </Button>
        </div>
      )}

      {error ? (
        <ErrorMessage title="Decision was not recorded" message={error} />
      ) : null}

      <ConfirmationDialog
        open={pending !== null}
        title={`${pending ? decisionLabel(pending) : 'Confirm'} recommendation?`}
        message={pending === 'approve'
          ? `${SAFETY_COPY} Confirm only if a human operator accepts this recommended next step.`
          : pending === 'reject'
            ? `${SAFETY_COPY} A comment is required to reject this recommendation.`
            : `${SAFETY_COPY} A comment is required to defer this recommendation.`}
        confirmLabel={pending ? decisionLabel(pending) : 'Confirm'}
        cancelLabel="Cancel"
        tone={pending === 'reject' ? 'danger' : 'default'}
        busy={submitting}
        comment={pending ? {
          label: pending === 'approve' ? 'Comment' : 'Reason',
          value: comment,
          onChange: setComment,
          required: pending ? commentRequiredFor(pending) : false,
          placeholder: pending === 'approve'
            ? 'Optional audit note. Approval still does not change the network.'
            : 'Explain why this recommendation is rejected or deferred.',
        } : undefined}
        onCancel={close}
        onConfirm={() => { void confirm() }}
      />
    </div>
  )
}

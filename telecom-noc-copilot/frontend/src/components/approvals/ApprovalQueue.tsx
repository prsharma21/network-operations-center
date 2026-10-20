import { Card } from '@/components/common/Card'
import { EmptyState } from '@/components/common/EmptyState'
import { ApprovalActions } from '@/components/approvals/ApprovalActions'
import { ApprovalRecord } from '@/components/approvals/ApprovalRecord'
import type { ApprovalDecision, ApprovalRequest } from '@/types/approval'

interface ApprovalQueueProps {
  items: ApprovalRequest[]
  submittingId: string | null
  submitError: { incidentId: string; message: string } | null
  onDecide: (item: ApprovalRequest, decision: ApprovalDecision, comment: string) => Promise<boolean>
}

export function ApprovalQueue({ items, submittingId, submitError, onDecide }: ApprovalQueueProps) {
  if (items.length === 0) {
    return (
      <Card title="Approval queue">
        <EmptyState
          title="No approval requests"
          description="There are no recommendations in this filter. Investigate an incident to generate a proposed next step for human review."
        />
      </Card>
    )
  }

  return (
    <div className="approval-queue">
      {items.map((item) => (
        <Card key={item.id} title={`${item.incidentId} · ${item.title}`}>
          <ApprovalRecord request={item} showIncidentLink />
          <ApprovalActions
            request={item}
            submitting={submittingId === item.incidentId}
            error={submitError?.incidentId === item.incidentId ? submitError.message : null}
            onDecide={(decision, comment) => onDecide(item, decision, comment)}
          />
        </Card>
      ))}
    </div>
  )
}

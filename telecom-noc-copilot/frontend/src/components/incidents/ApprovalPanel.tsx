import { Card } from '@/components/common/Card'
import { EmptyState } from '@/components/common/EmptyState'
import { ApprovalActions } from '@/components/approvals/ApprovalActions'
import { ApprovalRecord } from '@/components/approvals/ApprovalRecord'
import type { ApprovalDecision } from '@/types/approval'
import type { IncidentInvestigation } from '@/types/incident'

interface ApprovalPanelProps {
  incident: IncidentInvestigation
  submitting: boolean
  error: string | null
  onDecide: (decision: ApprovalDecision, comment: string) => Promise<boolean>
}

export function ApprovalPanel({ incident, submitting, error, onDecide }: ApprovalPanelProps) {
  const request = incident.recommendation

  return (
    <Card title="Recommended next step">
      {!request ? (
        <>
          <p className="approval-actions__safety" role="note">
            Approve or reject only records a human decision. It does not change the live network.
          </p>
          <EmptyState
            compact
            title="No recommendation yet"
            description="Click Investigate this problem to generate a suggested next step for review."
          />
        </>
      ) : (
        <>
          <ApprovalRecord request={request} />
          <ApprovalActions
            request={request}
            submitting={submitting}
            error={error}
            onDecide={onDecide}
          />
        </>
      )}
    </Card>
  )
}

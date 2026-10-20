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
    <Card title="Recommendation and approval">
      {!request ? (
        <>
          <p className="approval-actions__safety" role="note">
            Approval records a human decision. It does not mean a network action was executed.
            This page never issues a live change. Backend authorization is required; disabled controls are not a security boundary.
          </p>
          <EmptyState
            compact
            title="No recommendation yet"
            description="Run Investigate Incident to generate a proposed next step for human review. You can also open the Approvals queue after a recommendation exists."
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

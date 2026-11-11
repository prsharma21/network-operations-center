import { Link, useParams } from 'react-router-dom'
import { Button } from '@/components/common/Button'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorMessage } from '@/components/common/ErrorMessage'
import { LoadingIndicator } from '@/components/common/LoadingIndicator'
import { PageHeader } from '@/components/common/PageHeader'
import { ApprovalPanel } from '@/components/incidents/ApprovalPanel'
import { CandidateCauses } from '@/components/incidents/CandidateCauses'
import { CorrelatedAlarms } from '@/components/incidents/CorrelatedAlarms'
import { IncidentSummary } from '@/components/incidents/IncidentSummary'
import { IncidentTimeline } from '@/components/incidents/IncidentTimeline'
import { InvestigationControls } from '@/components/incidents/InvestigationControls'
import { NetworkEvidence } from '@/components/incidents/NetworkEvidence'
import { RunbookEvidence } from '@/components/incidents/RunbookEvidence'
import { useIncident } from '@/hooks/useIncident'
import { friendlyIncidentTitle } from '@/utils/plainLanguage'

export function IncidentDetailPage() {
  const { incidentId } = useParams()
  const {
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
  } = useIncident(incidentId)

  return (
    <div className="page">
      <PageHeader
        title={data ? `${data.incidentId}` : (incidentId ?? 'Problem')}
        description={
          data
            ? `${friendlyIncidentTitle(data.title)}. Review the story below — nothing is confirmed, and nothing changes the live network.`
            : 'Open a problem, investigate it, and review possible causes.'
        }
        actions={
          <Link className="btn btn--secondary" to="/incidents">
            Back to problems
          </Link>
        }
      />

      {loading ? (
        <div className="dashboard-state">
          <LoadingIndicator label="Loading problem" />
        </div>
      ) : null}

      {error ? (
        <ErrorMessage
          title="Problem unavailable"
          message={error}
          action={<Button variant="secondary" onClick={reload}>Retry</Button>}
        />
      ) : null}

      {!loading && !error && !data ? (
        <EmptyState
          title="Problem not found"
          description="This problem ID is not in the current list."
          action={<Link className="btn btn--secondary" to="/incidents">View problems</Link>}
        />
      ) : null}

      {data && !loading ? (
        <div className="incident-workspace">
          <IncidentSummary incident={data} />
          <InvestigationControls incident={data} investigating={investigating} onInvestigate={() => void investigate()} />
          <CorrelatedAlarms alarms={data.correlatedAlarms} />
          <IncidentTimeline events={data.timeline} />
          <NetworkEvidence items={data.evidence} />
          <RunbookEvidence
            incident={data}
            investigating={investigating}
            retrieving={retrievingRunbooks}
            error={runbookError}
            onRetrieve={() => void retrieveRunbooks()}
          />
          <CandidateCauses candidates={data.candidates} investigationStatus={data.investigationStatus} />
          <ApprovalPanel
            incident={data}
            submitting={submittingApproval}
            error={approvalError}
            onDecide={approve}
          />
        </div>
      ) : null}
    </div>
  )
}

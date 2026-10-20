import { Link, useParams } from 'react-router-dom'
import { Button } from '@/components/common/Button'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorMessage } from '@/components/common/ErrorMessage'
import { LoadingIndicator } from '@/components/common/LoadingIndicator'
import { PageHeader } from '@/components/common/PageHeader'
import { DemoDataBanner } from '@/components/dashboard/DemoDataBanner'
import { ApprovalPanel } from '@/components/incidents/ApprovalPanel'
import { CandidateCauses } from '@/components/incidents/CandidateCauses'
import { CorrelatedAlarms } from '@/components/incidents/CorrelatedAlarms'
import { IncidentSummary } from '@/components/incidents/IncidentSummary'
import { IncidentTimeline } from '@/components/incidents/IncidentTimeline'
import { InvestigationControls } from '@/components/incidents/InvestigationControls'
import { NetworkEvidence } from '@/components/incidents/NetworkEvidence'
import { RunbookEvidence } from '@/components/incidents/RunbookEvidence'
import { useIncident } from '@/hooks/useIncident'

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
        title={data ? `${data.incidentId}` : (incidentId ?? 'Incident')}
        description={data?.title ?? 'Incident investigation workspace. Hypotheses are not verified root causes, and no network change is executed here.'}
        actions={
          <Link className="btn btn--secondary" to="/incidents">
            Back to incidents
          </Link>
        }
      />

      {loading ? (
        <div className="dashboard-state">
          <LoadingIndicator label="Loading incident" />
        </div>
      ) : null}

      {error ? (
        <ErrorMessage
          title="Incident unavailable"
          message={error}
          action={<Button variant="secondary" onClick={reload}>Retry</Button>}
        />
      ) : null}

      {!loading && !error && !data ? (
        <EmptyState
          title="Incident not found"
          description="This incident ID is not in the current catalog."
          action={<Link className="btn btn--secondary" to="/incidents">View incidents</Link>}
        />
      ) : null}

      {data && !loading ? (
        <div className="incident-workspace">
          {data.source === 'demo' ? (
            <DemoDataBanner asOf={data.asOf} missingEndpoints={data.missingEndpoints} />
          ) : null}
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

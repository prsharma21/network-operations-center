import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/common/Button'
import { Card } from '@/components/common/Card'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorMessage } from '@/components/common/ErrorMessage'
import { LoadingIndicator } from '@/components/common/LoadingIndicator'
import { PageHeader } from '@/components/common/PageHeader'
import { SeverityBadge } from '@/components/common/SeverityBadge'
import { StatusBadge } from '@/components/common/StatusBadge'
import { DemoDataBanner } from '@/components/dashboard/DemoDataBanner'
import { ReportDocument } from '@/components/reports/ReportDocument'
import { useIncidentReport, useReportCatalog } from '@/hooks/useIncidentReport'
import { getNavItem } from '@/routes/navigation'
import type { IncidentReport } from '@/types/report'
import { formatDateTime } from '@/utils/format'

const page = getNavItem('/reports')

function exportReportJson(report: IncidentReport): void {
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${report.reportId}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}

export function ReportsPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const incidentId = params.get('incident') ?? params.get('incident_id')
  const reportId = params.get('report') ?? params.get('report_id')
  const catalog = useReportCatalog(!incidentId)
  const report = useIncidentReport(incidentId, reportId)
  const loaded = report.data

  if (incidentId) {
    return (
      <div className="page report-page">
        <PageHeader
          title={loaded ? `Report ${loaded.reportId}` : 'Incident report'}
          description="Read-only incident report. Observed facts, AI hypotheses, recommendations, and human decisions are labeled separately. No network change is executed here."
          actions={
            <div className="report-page__actions">
              {loaded ? (
                <>
                  <Button variant="secondary" onClick={() => exportReportJson(loaded)}>
                    Export JSON
                  </Button>
                  <Button variant="secondary" onClick={() => window.print()}>
                    Print
                  </Button>
                </>
              ) : null}
              <Link className="btn btn--secondary" to={`/incidents/${incidentId}`}>
                Open incident
              </Link>
              <Link className="btn btn--secondary" to="/reports">
                All reports
              </Link>
            </div>
          }
        />

        {report.loading ? (
          <div className="dashboard-state">
            <LoadingIndicator label="Loading incident report" />
          </div>
        ) : null}

        {report.error && !report.notFound ? (
          <ErrorMessage
            title="Report unavailable"
            message={report.error}
            action={<Button variant="secondary" onClick={report.reload}>Retry</Button>}
          />
        ) : null}

        {report.notFound ? (
          <EmptyState
            title="Report not found"
            description={report.error ?? 'No report has been generated for this incident. Investigate the incident first. This page does not invent evidence, approvals, or executed actions.'}
            action={
              <div className="report-page__actions">
                <Link className="btn btn--primary" to={`/incidents/${incidentId}`}>Investigate incident</Link>
                <Link className="btn btn--secondary" to="/reports">Back to reports</Link>
              </div>
            }
          />
        ) : null}

        {loaded && !report.loading ? (
          <>
            {loaded.source === 'demo' ? (
              <DemoDataBanner asOf={loaded.asOf} missingEndpoints={loaded.missingEndpoints} />
            ) : null}
            <ReportDocument report={loaded} />
          </>
        ) : null}
      </div>
    )
  }

  return (
    <div className="page">
      <PageHeader
        title="Incident reports"
        description={page.description}
        actions={<Button variant="secondary" onClick={catalog.reload}>Refresh</Button>}
      />

      {catalog.loading ? (
        <div className="dashboard-state">
          <LoadingIndicator label="Loading reports" />
        </div>
      ) : null}

      {catalog.error ? (
        <ErrorMessage
          title="Reports unavailable"
          message={catalog.error}
          action={<Button variant="secondary" onClick={catalog.reload}>Retry</Button>}
        />
      ) : null}

      {!catalog.loading && !catalog.error ? (
        <>
          {catalog.data?.source === 'demo' ? (
            <DemoDataBanner asOf={catalog.data.asOf} missingEndpoints={catalog.data.missingEndpoints} />
          ) : null}
          <Card title="Generated reports" className="card--table">
            {(catalog.data?.items.length ?? 0) === 0 ? (
              <EmptyState
                title="No reports yet"
                description="A report is created after incident investigation. This catalog does not invent reports, evidence, or executed actions."
                action={<Link className="btn btn--secondary" to="/incidents">Open incidents</Link>}
              />
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Report</th>
                      <th scope="col">Incident</th>
                      <th scope="col">Severity</th>
                      <th scope="col">Status</th>
                      <th scope="col">Generated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {catalog.data?.items.map((item) => (
                      <tr
                        key={item.reportId}
                        className="data-table__row--clickable"
                        tabIndex={0}
                        aria-label={`Open report ${item.reportId}`}
                        onClick={() => navigate(`/reports?incident=${encodeURIComponent(item.incidentId)}&report=${encodeURIComponent(item.reportId)}`)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            navigate(`/reports?incident=${encodeURIComponent(item.incidentId)}&report=${encodeURIComponent(item.reportId)}`)
                          }
                        }}
                      >
                        <td>
                          <Link
                            className="table-link"
                            to={`/reports?incident=${encodeURIComponent(item.incidentId)}&report=${encodeURIComponent(item.reportId)}`}
                            onClick={(event) => event.stopPropagation()}
                          >
                            {item.reportId}
                          </Link>
                          <div className="muted">{item.title}</div>
                        </td>
                        <td>
                          <Link to={`/incidents/${item.incidentId}`} onClick={(event) => event.stopPropagation()}>
                            {item.incidentId}
                          </Link>
                        </td>
                        <td><SeverityBadge severity={item.severity} /></td>
                        <td><StatusBadge status={item.status} /></td>
                        <td>{formatDateTime(item.generatedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      ) : null}
    </div>
  )
}

import { Card } from '@/components/common/Card'
import { EmptyState } from '@/components/common/EmptyState'
import type { EvidenceCategory, NetworkEvidenceItem } from '@/types/incident'
import { formatDateTime } from '@/utils/format'
import { friendlyEvidenceSummary, friendlyMetricDetail, friendlyTimelineTitle } from '@/utils/plainLanguage'

const CATEGORY_LABEL: Record<EvidenceCategory, string> = {
  metric: 'Site health',
  inventory: 'Site details',
  topology: 'Network links',
  deployment: 'Recent software changes',
}

const CATEGORIES: EvidenceCategory[] = ['metric', 'inventory', 'topology', 'deployment']

interface NetworkEvidenceProps {
  items: NetworkEvidenceItem[]
}

export function NetworkEvidence({ items = [] }: NetworkEvidenceProps) {
  return (
    <Card title="What we found">
      {items.length === 0 ? (
        <EmptyState
          compact
          title="No evidence yet"
          description="Run Investigate to collect site health, links, and recent changes."
        />
      ) : (
        <div className="evidence-groups">
          {CATEGORIES.map((category) => {
            const group = items.filter((item) => item.category === category)
            if (group.length === 0) return null
            return (
              <section key={category} className="evidence-group">
                <h4>{CATEGORY_LABEL[category]}</h4>
                <ul>
                  {group.map((item) => (
                    <li key={item.id}>
                      <p className="evidence-group__title">
                        {friendlyTimelineTitle(
                          item.title,
                          /kpi|latency|throughput|utilization|dropped/i.test(item.title + item.detail)
                            ? 'kpi'
                            : undefined,
                        )}
                      </p>
                      <p>
                        {/latency_ms=|throughput_mbps=|utilization_pct=|dropped_call_rate_pct=|state=abnormal/i.test(item.detail)
                          ? friendlyMetricDetail(item.detail)
                          : friendlyEvidenceSummary(item.detail)}
                      </p>
                      <p className="muted">
                        {formatDateTime(item.timestamp)}
                        {item.sourceEventId ? ` · ref ${item.sourceEventId}` : ''}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      )}
    </Card>
  )
}

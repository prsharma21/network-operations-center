import { Card } from '@/components/common/Card'
import { EmptyState } from '@/components/common/EmptyState'
import type { EvidenceCategory, NetworkEvidenceItem } from '@/types/incident'
import { formatDateTime } from '@/utils/format'

const CATEGORY_LABEL: Record<EvidenceCategory, string> = {
  metric: 'Site metrics',
  inventory: 'Inventory',
  topology: 'Topology',
  deployment: 'Recent deployment',
}

const CATEGORIES: EvidenceCategory[] = ['metric', 'inventory', 'topology', 'deployment']

interface NetworkEvidenceProps {
  items: NetworkEvidenceItem[]
}

export function NetworkEvidence({ items = [] }: NetworkEvidenceProps) {
  return (
    <Card title="Network evidence">
      {items.length === 0 ? (
        <EmptyState compact title="No evidence attached" description="Metrics, inventory, topology, and deployments will be listed with source event IDs." />
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
                      <p className="evidence-group__title">{item.title}</p>
                      <p>{item.detail}</p>
                      <p className="muted">
                        {formatDateTime(item.timestamp)} · source {item.sourceEventId}
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

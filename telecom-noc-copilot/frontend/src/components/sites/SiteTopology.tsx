import { Card } from '@/components/common/Card'
import { EmptyState } from '@/components/common/EmptyState'
import { StatusBadge } from '@/components/common/StatusBadge'
import type { SiteTopology as SiteTopologyModel } from '@/types/site'

interface SiteTopologyProps {
  topology: SiteTopologyModel
  synthetic: boolean
}

const KIND_LABEL = {
  site: 'Site',
  aggregation: 'Aggregation',
  core: 'Core',
} as const

export function SiteTopology({ topology, synthetic }: SiteTopologyProps) {
  const ordered = [...topology.nodes].sort((left, right) => rank(left.kind) - rank(right.kind))

  return (
    <Card title="Connected topology">
      {topology.nodes.length === 0 ? (
        <EmptyState compact title="No topology" description="No topology links are available for this site." />
      ) : (
        <div className="topology">
          {synthetic ? (
            <p className="topology__notice">Synthetic topology from the demo dataset. Not a live network view.</p>
          ) : null}
          <svg className="topology__canvas" viewBox="0 0 720 160" role="img" aria-label="Site backhaul path to aggregation and core">
            {ordered.map((node, index) => {
              const x = 80 + index * 220
              const fill = node.status === 'critical' ? '#fdecec' : '#eef3f9'
              const stroke = node.status === 'critical' ? '#9f2c23' : '#0b1f3a'
              return (
                <g key={node.id}>
                  {index < ordered.length - 1 ? (
                    <line
                      x1={x + 70}
                      y1={70}
                      x2={x + 150}
                      y2={70}
                      stroke={topology.edges[index]?.status === 'critical' ? '#9f2c23' : '#1c3f68'}
                      strokeWidth="2"
                    />
                  ) : null}
                  <rect x={x - 70} y={28} width="140" height="84" rx="8" fill={fill} stroke={stroke} />
                  <text x={x} y={58} textAnchor="middle" fill="#5c6b7e" fontSize="11">
                    {KIND_LABEL[node.kind]}
                  </text>
                  <text x={x} y={80} textAnchor="middle" fill="#152033" fontSize="13" fontWeight="650">
                    {node.id}
                  </text>
                  <text x={x} y={98} textAnchor="middle" fill="#5c6b7e" fontSize="11">
                    {node.label === node.id ? node.status : node.label}
                  </text>
                </g>
              )
            })}
          </svg>
          <ul className="topology__legend">
            {topology.edges.map((edge) => (
              <li key={edge.id}>
                {edge.from} → {edge.to} · {edge.linkType} · {edge.capacityMbps} Mbps{' '}
                <StatusBadge status={edge.status} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}

function rank(kind: 'site' | 'aggregation' | 'core'): number {
  if (kind === 'site') return 0
  if (kind === 'aggregation') return 1
  return 2
}

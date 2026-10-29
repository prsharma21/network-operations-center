import { StatusBadge } from '@/components/common/StatusBadge'
import type { SiteKpiSnapshot } from '@/types/site'
import type { OperationalStatus } from '@/types/ui'
import { formatLatency, formatMbps, formatPercent } from '@/utils/format'
import { describeThreshold, type KpiLevel, type KpiName } from '@/utils/kpiThresholds'

interface SiteKpiTilesProps {
  kpis: SiteKpiSnapshot
}

const LEVEL_STATUS: Record<KpiLevel, OperationalStatus> = {
  normal: 'healthy',
  warning: 'degraded',
  critical: 'critical',
  unavailable: 'inactive',
}

const LEVEL_LABEL: Record<KpiLevel, string> = {
  normal: 'Normal',
  warning: 'Warning',
  critical: 'Critical',
  unavailable: 'Unavailable',
}

const TILES: { name: KpiName; label: string; value: (kpis: SiteKpiSnapshot) => string; level: (kpis: SiteKpiSnapshot) => KpiLevel }[] = [
  {
    name: 'latencyMs',
    label: 'Latency',
    value: (kpis) => formatLatency(kpis.latencyMs),
    level: (kpis) => kpis.latencyLevel,
  },
  {
    name: 'throughputMbps',
    label: 'Throughput',
    value: (kpis) => formatMbps(kpis.throughputMbps),
    level: (kpis) => kpis.throughputLevel,
  },
  {
    name: 'utilizationPct',
    label: 'Utilization',
    value: (kpis) => formatPercent(kpis.utilizationPct),
    level: (kpis) => kpis.utilizationLevel,
  },
  {
    name: 'droppedCallRatePct',
    label: 'Dropped-call rate',
    value: (kpis) => formatPercent(kpis.droppedCallRatePct, 2),
    level: (kpis) => kpis.droppedCallLevel,
  },
]

const EMPTY_KPIS: SiteKpiSnapshot = {
  latencyMs: null,
  throughputMbps: null,
  utilizationPct: null,
  droppedCallRatePct: null,
  latencyLevel: 'unavailable',
  throughputLevel: 'unavailable',
  utilizationLevel: 'unavailable',
  droppedCallLevel: 'unavailable',
}

export function SiteKpiTiles({ kpis = EMPTY_KPIS }: SiteKpiTilesProps) {
  return (
    <section className="kpi-grid kpi-grid--four" aria-label="Site key performance indicators">
      {TILES.map((tile) => {
        const level = tile.level(kpis)
        return (
          <article key={tile.name} className={`metric-tile metric-tile--${level}`}>
            <span className="kpi-card__label">{tile.label}</span>
            <span className="kpi-card__value">{tile.value(kpis)}</span>
            <StatusBadge status={LEVEL_STATUS[level]} label={LEVEL_LABEL[level]} />
            <span className="kpi-card__hint">{describeThreshold(tile.name)}</span>
          </article>
        )
      })}
    </section>
  )
}

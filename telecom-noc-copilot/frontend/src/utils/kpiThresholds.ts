export type KpiName = 'latencyMs' | 'throughputMbps' | 'utilizationPct' | 'droppedCallRatePct'
export type KpiLevel = 'normal' | 'warning' | 'critical' | 'unavailable'
export type ThresholdDirection = 'higher-worse' | 'lower-worse'

export interface KpiThreshold {
  warning: number
  critical: number
  direction: ThresholdDirection
  unit: string
}

/**
 * Single source of truth for site KPI bands used by tiles, charts, and badges.
 * Values follow the synthetic NOC dataset: congestion ~92% utilization / 150 ms latency,
 * and a site outage reports ~999 ms with 0 throughput.
 */
export const KPI_THRESHOLDS: Record<KpiName, KpiThreshold> = {
  latencyMs: { warning: 80, critical: 150, direction: 'higher-worse', unit: 'ms' },
  throughputMbps: { warning: 80, critical: 20, direction: 'lower-worse', unit: 'Mbps' },
  utilizationPct: { warning: 70, critical: 92, direction: 'higher-worse', unit: '%' },
  droppedCallRatePct: { warning: 2, critical: 5, direction: 'higher-worse', unit: '%' },
}

export const LATENCY_UNAVAILABLE_MS = 900

export function classifyKpi(name: KpiName, value: number | null | undefined): KpiLevel {
  if (value === null || value === undefined || Number.isNaN(value)) return 'unavailable'
  if (name === 'latencyMs' && value >= LATENCY_UNAVAILABLE_MS) return 'unavailable'

  const rule = KPI_THRESHOLDS[name]
  if (rule.direction === 'higher-worse') {
    if (value >= rule.critical) return 'critical'
    if (value >= rule.warning) return 'warning'
    return 'normal'
  }
  if (value <= rule.critical) return 'critical'
  if (value <= rule.warning) return 'warning'
  return 'normal'
}

export function describeThreshold(name: KpiName): string {
  const rule = KPI_THRESHOLDS[name]
  if (rule.direction === 'higher-worse') {
    return `Normal < ${rule.warning}${rule.unit} · Warning ≥ ${rule.warning} · Critical ≥ ${rule.critical}`
  }
  return `Normal > ${rule.warning}${rule.unit} · Warning ≤ ${rule.warning} · Critical ≤ ${rule.critical}`
}

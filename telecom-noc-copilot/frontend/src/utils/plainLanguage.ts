/** Friendly display labels for demo-facing incident screens. */

const ALARM_LABELS: Record<string, string> = {
  SITE_UNREACHABLE: 'Site cannot be reached',
  BACKHAUL_LINK_DOWN: 'Connection link is down',
  CELL_AVAILABILITY_LOSS: 'No service at this site',
  HIGH_PRB_UTILIZATION: 'Radio capacity is overloaded',
  HIGH_UTILIZATION: 'Site is very busy',
  HIGH_LATENCY: 'Slow response time',
  THROUGHPUT_DEGRADATION: 'Data speed dropped',
  LOW_THROUGHPUT: 'Data speed is low',
  DROPPED_CALLS_HIGH: 'Many calls are dropping',
  POST_DEPLOYMENT_KPI_DEGRADATION: 'Health worsened after a software change',
  CONFIGURATION_MISMATCH: 'Settings do not match expected config',
  ACCESSIBILITY_DEGRADATION: 'Users cannot reach the site normally',
  SYNC_FAILURE: 'Timing sync failed',
  TEMPERATURE_WARNING: 'Temperature warning',
  POWER_WARNING: 'Power warning',
}

const SOURCE_LABELS: Record<string, string> = {
  alarm: 'Alert',
  telemetry: 'Health check',
  deployment: 'Software change',
  runbook: 'Guide',
  'evidence review': 'Evidence check',
  'site inventory': 'Site record',
  topology: 'Network link',
}

export function friendlyAlarmLabel(code: string | null | undefined): string {
  const key = (code ?? '').trim().toUpperCase()
  if (!key) return 'Alert'
  return ALARM_LABELS[key] ?? key.replaceAll('_', ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase())
}

export function friendlySourceLabel(source: string | null | undefined): string {
  const key = (source ?? '').trim().toLowerCase()
  return SOURCE_LABELS[key] ?? (source || 'Source')
}

export function friendlyTimelineKind(kind: string): string {
  if (kind === 'alarm') return 'Alert'
  if (kind === 'kpi') return 'Health check'
  if (kind === 'deployment') return 'Software change'
  if (kind === 'investigation') return 'Investigation'
  if (kind === 'approval') return 'Approval'
  return kind
}

export function friendlyTimelineTitle(title: string, kind?: string): string {
  const text = title.trim()
  if (!text) return 'Update'
  if (/^abnormal kpi/i.test(text) || text === 'KPI sample' || (kind === 'kpi' && /^kpi/i.test(text))) {
    return 'Site health looks bad'
  }
  if (/^topology link$/i.test(text)) return 'Network link status'
  if (/inventory/i.test(text)) return 'Site details'
  if (/investigation report/i.test(text)) return 'Investigation finished'
  if (/^deployment/i.test(text)) return 'Software change recorded'
  // Alarm codes and similar titles keep the friendly alert wording.
  if (/^[A-Z0-9_]+$/.test(text) || ALARM_LABELS[text.toUpperCase()]) {
    return friendlyAlarmLabel(text)
  }
  if (kind === 'kpi') return 'Site health looks bad'
  return text
}

export function friendlyMetricDetail(detail: string): string {
  const text = detail.trim()
  if (!text) return 'Health check recorded.'

  if (/^state=abnormal$/i.test(text)) {
    return 'Site health was marked as bad.'
  }

  const latency = text.match(/latency_ms=([0-9.]+)/i)
  const throughput = text.match(/throughput_mbps=([0-9.]+)/i)
  const utilization = text.match(/utilization_pct=([0-9.]+)/i)
  const dropped = text.match(/dropped_call_rate_pct=([0-9.]+)/i)

  if (latency || throughput || utilization || dropped) {
    const parts: string[] = []
    if (latency && Number(latency[1]) >= 900) parts.push('connection looks unavailable')
    else if (latency) parts.push(`response time ${latency[1]} ms`)
    if (throughput && Number(throughput[1]) <= 20) parts.push('almost no data speed')
    else if (throughput) parts.push(`data speed ${throughput[1]} Mbps`)
    if (utilization && Number(utilization[1]) >= 92) parts.push('very high usage')
    else if (utilization) parts.push(`usage ${utilization[1]}%`)
    if (dropped && Number(dropped[1]) >= 5) parts.push('many dropped calls')
    else if (dropped) parts.push(`dropped calls ${dropped[1]}%`)
    return parts.length ? `Health check: ${parts.join(', ')}.` : 'Health check recorded.'
  }

  return friendlyEvidenceSummary(text)
}

export function friendlyEvidenceSummary(summary: string): string {
  let text = summary.trim()
  if (!text) return 'Evidence recorded.'

  text = text.replace(/\bSITE_UNREACHABLE\b/gi, 'Site cannot be reached')
  text = text.replace(/\bBACKHAUL_LINK_DOWN\b/gi, 'Connection link is down')
  text = text.replace(/\bCELL_AVAILABILITY_LOSS\b/gi, 'No service at this site')
  text = text.replace(/\bHIGH_PRB_UTILIZATION\b/gi, 'Radio capacity is overloaded')
  text = text.replace(/\bCONFIGURATION_MISMATCH\b/gi, 'Settings mismatch')
  text = text.replace(/\bPOST_DEPLOYMENT_KPI_DEGRADATION\b/gi, 'Health drop after software change')
  text = text.replace(/^Abnormal KPI sample recorded for this site\.?$/i, 'Site health check failed.')
  text = text.replace(/^state=abnormal$/i, 'Site health was marked as bad.')
  text = text.replace(/->/g, 'to')
  text = text.replace(/\bstatus down\b/gi, 'is down')
  text = text.replace(/\bStatus degraded\b/gi, 'Site is degraded')
  text = text.replace(/\bbackhaul microwave\b/gi, 'microwave connection')
  return text
}

export function friendlyIncidentTitle(title: string): string {
  const text = title.trim()
  if (/backhaul isolation/i.test(text)) return 'Site outage — connection link problem'
  if (/radio congestion/i.test(text)) return 'Site congestion — too much traffic'
  if (/post-deployment|configuration/i.test(text)) return 'Problem after software change'
  return text
}

const RUNBOOK_TITLES: Record<string, string> = {
  'Site unreachable and backhaul path checks': 'Checks when a site cannot be reached',
  'High PRB utilization and congestion symptoms': 'Checks when a site is overloaded',
  'Post-deployment KPI degradation and configuration mismatch': 'Problem after a software change',
  'Site KPI warning and critical thresholds': 'When site health is warning or critical',
  'Timing synchronization failure checks': 'Checks when site timing is out of sync',
}

export function friendlyRunbookTitle(title: string | null | undefined): string {
  const text = (title ?? '').trim()
  if (!text) return 'Troubleshooting guide'
  return RUNBOOK_TITLES[text] ?? text
}

const COMPONENT_LABELS: Record<string, string> = {
  backhaul: 'Connection link',
  radio: 'Radio / capacity',
  configuration: 'Settings / software change',
  synchronization: 'Timing sync',
  environment: 'Environment',
  power: 'Power',
  unknown: 'Other',
}

export function friendlyComponentLabel(value: string | null | undefined): string {
  const key = (value ?? '').trim().toLowerCase()
  if (!key) return 'Other'
  return COMPONENT_LABELS[key] ?? value!.replaceAll('_', ' ')
}

export function friendlyKpiName(value: string | null | undefined): string {
  const key = (value ?? '').trim().toLowerCase()
  if (key === 'latency' || key === 'latencyms' || key === 'latency_ms') return 'Delay'
  if (key === 'throughput' || key === 'throughputmbps' || key === 'throughput_mbps') return 'Data speed'
  if (key === 'utilization' || key === 'utilizationpct' || key === 'utilization_pct') return 'Usage'
  if (key === 'dropped-call' || key === 'dropped_call' || key === 'droppedcallratepct') return 'Dropped calls'
  return value || 'Health number'
}

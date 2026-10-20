export interface SiteRecord {
  site_id: string
  site_name: string
  region: string
  status: string
  synthetic?: boolean
}

export interface AlarmRecord {
  alarm_id: string
  timestamp: string
  site_id: string
  region: string
  alarm_code: string
  severity: string
  status: string
  message: string
  scenario_id: string | null
  synthetic?: boolean
}

export interface TelemetryRecord {
  metric_id: string
  timestamp: string
  site_id: string
  latency_ms: number
  throughput_mbps: number
  utilization_pct: number
  dropped_call_rate_pct: number
  state: string
  synthetic?: boolean
}

export interface TicketRecord {
  ticket_id: string
  created_at: string
  site_id: string
  title: string
  priority: string
  status: string
  scenario_id: string | null
  synthetic?: boolean
}

export interface DeploymentRecord {
  deployment_id: string
  site_id: string
  timestamp: string
  change_type: string
  version_before: string
  version_after: string
  status: string
  notes: string
  synthetic?: boolean
}

export interface GroundTruthIncidentRecord {
  incident_id: string
  scenario_id: string
  site_id: string
  expected_cause: string
  evidence_alarm_ids: string[]
  deployment_id?: string
}

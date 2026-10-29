CREATE TABLE IF NOT EXISTS network_sites (
id VARCHAR(64) PRIMARY KEY,
site_code VARCHAR(80) NOT NULL UNIQUE,
name VARCHAR(200) NOT NULL,
region VARCHAR(100) NOT NULL,
status VARCHAR(40) NOT NULL DEFAULT 'ACTIVE',
configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS network_alarms (
id VARCHAR(64) PRIMARY KEY,
external_event_id VARCHAR(160) UNIQUE,
site_id VARCHAR(64) NOT NULL REFERENCES network_sites(id),
alarm_type VARCHAR(100) NOT NULL,
severity VARCHAR(30) NOT NULL,
status VARCHAR(40) NOT NULL DEFAULT 'OPEN',
description TEXT,
component VARCHAR(160),
occurred_at TIMESTAMPTZ NOT NULL,
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS telemetry_metrics (
id BIGSERIAL PRIMARY KEY,
site_id VARCHAR(64) NOT NULL REFERENCES network_sites(id),
metric_name VARCHAR(100) NOT NULL,
metric_value DOUBLE PRECISION NOT NULL,
unit VARCHAR(40),
recorded_at TIMESTAMPTZ NOT NULL,
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS deployments (
id VARCHAR(64) PRIMARY KEY,
site_id VARCHAR(64) NOT NULL REFERENCES network_sites(id),
deployment_type VARCHAR(100) NOT NULL,
version VARCHAR(100),
status VARCHAR(40) NOT NULL,
started_at TIMESTAMPTZ NOT NULL,
completed_at TIMESTAMPTZ,
details JSONB NOT NULL DEFAULT '{}'::jsonb,
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS incidents (
id VARCHAR(64) PRIMARY KEY,
site_id VARCHAR(64) NOT NULL REFERENCES network_sites(id),
title VARCHAR(250) NOT NULL,
description TEXT,
severity VARCHAR(30) NOT NULL,
status VARCHAR(40) NOT NULL DEFAULT 'OPEN',
opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
resolved_at TIMESTAMPTZ,
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS incident_alarms (
id BIGSERIAL PRIMARY KEY,
incident_id VARCHAR(64) NOT NULL REFERENCES incidents(id),
alarm_id VARCHAR(64) NOT NULL REFERENCES network_alarms(id),
linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
CONSTRAINT uq_incident_alarm UNIQUE (incident_id, alarm_id)
);
CREATE TABLE IF NOT EXISTS investigation_results (
id BIGSERIAL PRIMARY KEY,
incident_id VARCHAR(64) NOT NULL REFERENCES incidents(id),
investigation_method VARCHAR(80) NOT NULL DEFAULT 'RULE_BASED',
summary TEXT NOT NULL,
findings JSONB NOT NULL DEFAULT '{}'::jsonb,
confidence DOUBLE PRECISION,
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS runbook_references (
id BIGSERIAL PRIMARY KEY,
incident_id VARCHAR(64) REFERENCES incidents(id),
title VARCHAR(250) NOT NULL,
source_uri TEXT,
document_id VARCHAR(200),
relevance_score DOUBLE PRECISION,
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS remediation_actions (
id BIGSERIAL PRIMARY KEY,
incident_id VARCHAR(64) NOT NULL REFERENCES incidents(id),
action_type VARCHAR(100) NOT NULL,
description TEXT NOT NULL,
status VARCHAR(40) NOT NULL DEFAULT 'PROPOSED',
proposed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
approved_at TIMESTAMPTZ,
executed_at TIMESTAMPTZ,
execution_result JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE IF NOT EXISTS audit_events (
id BIGSERIAL PRIMARY KEY,
incident_id VARCHAR(64) REFERENCES incidents(id),
event_type VARCHAR(120) NOT NULL,
actor VARCHAR(160) NOT NULL,
details JSONB NOT NULL DEFAULT '{}'::jsonb,
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_network_alarms_site_occurred
ON network_alarms(site_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_network_alarms_severity_occurred
ON network_alarms(severity, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_site_recorded
ON telemetry_metrics(site_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_deployments_site_started
ON deployments(site_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_site_status
ON incidents(site_id, status);
CREATE INDEX IF NOT EXISTS idx_incidents_severity_opened
ON incidents(severity, opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_incident_alarms_incident
ON incident_alarms(incident_id);
CREATE INDEX IF NOT EXISTS idx_incident_alarms_alarm
ON incident_alarms(alarm_id);
CREATE INDEX IF NOT EXISTS idx_investigation_results_incident_created
ON investigation_results(incident_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_runbook_references_incident
ON runbook_references(incident_id);
CREATE INDEX IF NOT EXISTS idx_remediation_actions_incident_status
ON remediation_actions(incident_id, status);
CREATE INDEX IF NOT EXISTS idx_audit_events_incident_created
ON audit_events(incident_id, created_at DESC);

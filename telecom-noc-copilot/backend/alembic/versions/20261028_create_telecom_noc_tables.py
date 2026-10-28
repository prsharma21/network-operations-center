"""create telecom noc tables

Revision ID: 20261028_01
Revises:
Create Date: 2026-10-28

Creates the ten relational tables, foreign keys, indexes, and check constraints.
Downgrade drops these tables only; it does not touch unrelated schemas.
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20261028_01"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

UUID = postgresql.UUID(as_uuid=True)


def upgrade() -> None:
    op.create_table(
        "network_sites",
        sa.Column("id", UUID, primary_key=True, nullable=False),
        sa.Column("site_id", sa.String(32), nullable=False),
        sa.Column("site_code", sa.String(32), nullable=False),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("region", sa.String(64), nullable=False),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("technology", sa.String(32), nullable=False),
        sa.Column("vendor", sa.String(64), nullable=False),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("site_type", sa.String(64)),
        sa.Column("criticality", sa.String(32)),
        sa.Column("backhaul_type", sa.String(64)),
        sa.Column("known_scenario", sa.String(64)),
        sa.Column("synthetic", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("site_id", name="uq_network_sites_site_id"),
        sa.UniqueConstraint("site_code", name="uq_network_sites_site_code"),
        sa.CheckConstraint(
            "status IN ('up', 'down', 'degraded', 'maintenance')",
            name="ck_network_sites_status",
        ),
    )
    op.create_index("ix_network_sites_region_status", "network_sites", ["region", "status"])

    op.create_table(
        "network_alarms",
        sa.Column("id", UUID, primary_key=True, nullable=False),
        sa.Column("alarm_id", sa.String(64), nullable=False),
        sa.Column("source_event_id", sa.String(64)),
        sa.Column("fingerprint", sa.String(256)),
        sa.Column("site_id", UUID, nullable=False),
        sa.Column("alarm_code", sa.String(64), nullable=False),
        sa.Column("severity", sa.String(32), nullable=False),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("region", sa.String(64)),
        sa.Column("source", sa.String(64)),
        sa.Column("scenario_id", sa.String(64)),
        sa.Column("correlation_key", sa.String(128)),
        sa.Column("site_name", sa.String(128)),
        sa.Column("technology", sa.String(32)),
        sa.Column("vendor", sa.String(64)),
        sa.Column("network_component", sa.String(64)),
        sa.Column("source_severity", sa.String(32)),
        sa.Column("computed_severity", sa.String(32)),
        sa.Column("severity_rule", sa.String(64)),
        sa.Column("latency_ms", sa.Float()),
        sa.Column("throughput_mbps", sa.Float()),
        sa.Column("utilization_pct", sa.Float()),
        sa.Column("dropped_call_rate_pct", sa.Float()),
        sa.Column("synthetic", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.ForeignKeyConstraint(["site_id"], ["network_sites.id"], ondelete="RESTRICT"),
        sa.UniqueConstraint("alarm_id", name="uq_network_alarms_alarm_id"),
        sa.UniqueConstraint("source_event_id", name="uq_network_alarms_source_event_id"),
        sa.UniqueConstraint("fingerprint", name="uq_network_alarms_fingerprint"),
        sa.CheckConstraint(
            "severity IN ('critical', 'major', 'minor', 'warning', 'info', 'cleared')",
            name="ck_network_alarms_severity",
        ),
        sa.CheckConstraint(
            "status IN ('active', 'acknowledged', 'cleared')",
            name="ck_network_alarms_status",
        ),
    )
    op.create_index(
        "ix_network_alarms_site_id_occurred_at",
        "network_alarms",
        ["site_id", "occurred_at"],
    )
    op.create_index(
        "ix_network_alarms_severity_occurred_at",
        "network_alarms",
        ["severity", "occurred_at"],
    )

    op.create_table(
        "telemetry_metrics",
        sa.Column("id", UUID, primary_key=True, nullable=False),
        sa.Column("metric_id", sa.String(64), nullable=False),
        sa.Column("site_id", UUID, nullable=False),
        sa.Column("latency_ms", sa.Float(), nullable=False),
        sa.Column("throughput_mbps", sa.Float(), nullable=False),
        sa.Column("utilization_pct", sa.Float(), nullable=False),
        sa.Column("dropped_call_rate_pct", sa.Float(), nullable=False),
        sa.Column("sample_window_minutes", sa.Integer(), nullable=False, server_default="5"),
        sa.Column("state", sa.String(32), nullable=False, server_default="normal"),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("synthetic", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.ForeignKeyConstraint(["site_id"], ["network_sites.id"], ondelete="RESTRICT"),
        sa.UniqueConstraint("metric_id", name="uq_telemetry_metrics_metric_id"),
        sa.CheckConstraint("state IN ('normal', 'abnormal')", name="ck_telemetry_metrics_state"),
    )
    op.create_index(
        "ix_telemetry_metrics_site_id_recorded_at",
        "telemetry_metrics",
        ["site_id", "recorded_at"],
    )

    op.create_table(
        "deployments",
        sa.Column("id", UUID, primary_key=True, nullable=False),
        sa.Column("deployment_id", sa.String(64), nullable=False),
        sa.Column("site_id", UUID, nullable=False),
        sa.Column("change_type", sa.String(32), nullable=False),
        sa.Column("version_before", sa.String(64), nullable=False),
        sa.Column("version_after", sa.String(64), nullable=False),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("notes", sa.Text(), nullable=False),
        sa.Column("change_ticket", sa.String(64)),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("synthetic", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.ForeignKeyConstraint(["site_id"], ["network_sites.id"], ondelete="RESTRICT"),
        sa.UniqueConstraint("deployment_id", name="uq_deployments_deployment_id"),
        sa.CheckConstraint(
            "change_type IN ('software', 'configuration')",
            name="ck_deployments_change_type",
        ),
        sa.CheckConstraint(
            "status IN ('in_progress', 'completed', 'completed_with_warning', "
            "'failed', 'rolled_back')",
            name="ck_deployments_status",
        ),
    )
    op.create_index("ix_deployments_site_id_started_at", "deployments", ["site_id", "started_at"])

    op.create_table(
        "incidents",
        sa.Column("id", UUID, primary_key=True, nullable=False),
        sa.Column("incident_id", sa.String(64), nullable=False),
        sa.Column("site_id", UUID, nullable=False),
        sa.Column("title", sa.String(256), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("severity", sa.String(32), nullable=False),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("priority", sa.String(8)),
        sa.Column("scenario_id", sa.String(64)),
        sa.Column("opened_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("resolved_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("synthetic", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.ForeignKeyConstraint(["site_id"], ["network_sites.id"], ondelete="RESTRICT"),
        sa.UniqueConstraint("incident_id", name="uq_incidents_incident_id"),
        sa.CheckConstraint(
            "severity IN ('critical', 'major', 'minor', 'warning', 'info', 'cleared')",
            name="ck_incidents_severity",
        ),
        sa.CheckConstraint(
            "status IN ('OPEN', 'INVESTIGATING', 'AWAITING_APPROVAL', 'CLOSED')",
            name="ck_incidents_status",
        ),
    )
    op.create_index("ix_incidents_site_id_status", "incidents", ["site_id", "status"])
    op.create_index("ix_incidents_severity_opened_at", "incidents", ["severity", "opened_at"])

    op.create_table(
        "incident_alarms",
        sa.Column("id", UUID, primary_key=True, nullable=False),
        sa.Column("incident_id", UUID, nullable=False),
        sa.Column("alarm_id", UUID, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["incident_id"], ["incidents.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["alarm_id"], ["network_alarms.id"], ondelete="RESTRICT"),
        sa.UniqueConstraint("incident_id", "alarm_id", name="uq_incident_alarms_pair"),
    )
    op.create_index("ix_incident_alarms_alarm_id", "incident_alarms", ["alarm_id"])

    op.create_table(
        "investigation_results",
        sa.Column("id", UUID, primary_key=True, nullable=False),
        sa.Column("investigation_id", sa.String(64), nullable=False),
        sa.Column("incident_id", UUID, nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("findings", sa.Text(), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("method", sa.String(64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["incident_id"], ["incidents.id"], ondelete="RESTRICT"),
        sa.UniqueConstraint("investigation_id", name="uq_investigation_results_investigation_id"),
    )
    op.create_index(
        "ix_investigation_results_incident_id_created_at",
        "investigation_results",
        ["incident_id", "created_at"],
    )

    op.create_table(
        "runbook_references",
        sa.Column("id", UUID, primary_key=True, nullable=False),
        sa.Column("reference_id", sa.String(64), nullable=False),
        sa.Column("incident_id", UUID),
        sa.Column("title", sa.String(256), nullable=False),
        sa.Column("source_uri", sa.String(512), nullable=False),
        sa.Column("document_id", sa.String(64)),
        sa.Column("relevance_score", sa.Float()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["incident_id"], ["incidents.id"], ondelete="SET NULL"),
        sa.UniqueConstraint("reference_id", name="uq_runbook_references_reference_id"),
    )
    op.create_index("ix_runbook_references_incident_id", "runbook_references", ["incident_id"])

    op.create_table(
        "remediation_actions",
        sa.Column("id", UUID, primary_key=True, nullable=False),
        sa.Column("action_id", sa.String(64), nullable=False),
        sa.Column("incident_id", UUID, nullable=False),
        sa.Column("action_type", sa.String(64), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="proposed"),
        sa.Column("proposed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("approved_at", sa.DateTime(timezone=True)),
        sa.Column("executed_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["incident_id"], ["incidents.id"], ondelete="RESTRICT"),
        sa.UniqueConstraint("action_id", name="uq_remediation_actions_action_id"),
        sa.CheckConstraint(
            "status IN ('proposed', 'pending', 'approved', 'rejected', 'executed')",
            name="ck_remediation_actions_status",
        ),
    )
    op.create_index(
        "ix_remediation_actions_incident_id_status",
        "remediation_actions",
        ["incident_id", "status"],
    )

    op.create_table(
        "audit_events",
        sa.Column("id", UUID, primary_key=True, nullable=False),
        sa.Column("event_id", sa.String(64), nullable=False),
        sa.Column("incident_id", UUID),
        sa.Column("event_type", sa.String(64), nullable=False),
        sa.Column("actor", sa.String(128), nullable=False),
        sa.Column("details", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["incident_id"], ["incidents.id"], ondelete="SET NULL"),
        sa.UniqueConstraint("event_id", name="uq_audit_events_event_id"),
    )
    op.create_index(
        "ix_audit_events_incident_id_created_at",
        "audit_events",
        ["incident_id", "created_at"],
    )
    op.create_index(
        "ix_audit_events_event_type_created_at",
        "audit_events",
        ["event_type", "created_at"],
    )


def downgrade() -> None:
    op.drop_table("audit_events")
    op.drop_table("remediation_actions")
    op.drop_table("runbook_references")
    op.drop_table("investigation_results")
    op.drop_table("incident_alarms")
    op.drop_table("incidents")
    op.drop_table("deployments")
    op.drop_table("telemetry_metrics")
    op.drop_table("network_alarms")
    op.drop_table("network_sites")

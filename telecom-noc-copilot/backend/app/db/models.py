"""SQLAlchemy 2.x mappings for the ten telecom NOC tables.

Public API identifiers (SITE-003, ALM-0001, MET-00001, DEP-001, INC-OUTAGE-001)
are unique business keys. Internal primary keys are UUIDs. Foreign keys use
``network_sites.id`` / ``incidents.id`` / ``network_alarms.id`` as required.

ON DELETE
---------
- Operational children of a site (alarms, telemetry, deployments, incidents)
  use RESTRICT so inventory cannot be removed while history exists.
- ``incident_alarms``, ``investigation_results``, and ``remediation_actions``
  use RESTRICT so incident history is not silently dropped.
- ``runbook_references.incident_id`` and ``audit_events.incident_id`` use
  SET NULL because those rows may outlive a single incident (reusable runbooks
  and audit trail). Audit rows are never cascade-deleted.

Telemetry is stored as wide KPI samples matching ``TelemetryMetric`` (latency,
throughput, utilization, dropped-call rate). That is the existing API contract;
an EAV metric_name/value/unit layout would break GET /telemetry consumers.
Dropped-call rate is the synthetic analog of packet loss in this dataset.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

SITE_STATUSES = ("up", "down", "degraded", "maintenance")
ALARM_SEVERITIES = ("critical", "major", "minor", "warning", "info", "cleared")
ALARM_STATUSES = ("active", "acknowledged", "cleared")
TELEMETRY_STATES = ("normal", "abnormal")
DEPLOYMENT_STATUSES = (
    "in_progress",
    "completed",
    "completed_with_warning",
    "failed",
    "rolled_back",
)
DEPLOYMENT_TYPES = ("software", "configuration")
INCIDENT_STATUSES = ("OPEN", "INVESTIGATING", "AWAITING_APPROVAL", "CLOSED")
REMEDIATION_STATUSES = ("proposed", "pending", "approved", "rejected", "executed")


def utc_now() -> datetime:
    return datetime.now(UTC)


class NetworkSiteRow(Base):
    __tablename__ = "network_sites"
    __table_args__ = (
        UniqueConstraint("site_id", name="uq_network_sites_site_id"),
        UniqueConstraint("site_code", name="uq_network_sites_site_code"),
        CheckConstraint(
            "status IN ('up', 'down', 'degraded', 'maintenance')",
            name="ck_network_sites_status",
        ),
        Index("ix_network_sites_region_status", "region", "status"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    site_id: Mapped[str] = mapped_column(String(32), nullable=False)
    site_code: Mapped[str] = mapped_column(String(32), nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    region: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    technology: Mapped[str] = mapped_column(String(32), nullable=False)
    vendor: Mapped[str] = mapped_column(String(64), nullable=False)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    site_type: Mapped[str | None] = mapped_column(String(64))
    criticality: Mapped[str | None] = mapped_column(String(32))
    backhaul_type: Mapped[str | None] = mapped_column(String(64))
    known_scenario: Mapped[str | None] = mapped_column(String(64))
    synthetic: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now, onupdate=utc_now
    )

    alarms: Mapped[list[NetworkAlarmRow]] = relationship(back_populates="site")
    metrics: Mapped[list[TelemetryMetricRow]] = relationship(back_populates="site")
    deployments: Mapped[list[DeploymentRow]] = relationship(back_populates="site")
    incidents: Mapped[list[IncidentRow]] = relationship(back_populates="site")


class NetworkAlarmRow(Base):
    __tablename__ = "network_alarms"
    __table_args__ = (
        UniqueConstraint("alarm_id", name="uq_network_alarms_alarm_id"),
        UniqueConstraint("source_event_id", name="uq_network_alarms_source_event_id"),
        UniqueConstraint("fingerprint", name="uq_network_alarms_fingerprint"),
        CheckConstraint(
            "severity IN ('critical', 'major', 'minor', 'warning', 'info', 'cleared')",
            name="ck_network_alarms_severity",
        ),
        CheckConstraint(
            "status IN ('active', 'acknowledged', 'cleared')",
            name="ck_network_alarms_status",
        ),
        Index("ix_network_alarms_site_id_occurred_at", "site_id", "occurred_at"),
        Index("ix_network_alarms_severity_occurred_at", "severity", "occurred_at"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    alarm_id: Mapped[str] = mapped_column(String(64), nullable=False)
    source_event_id: Mapped[str | None] = mapped_column(String(64))
    fingerprint: Mapped[str | None] = mapped_column(String(256))
    site_id: Mapped[UUID] = mapped_column(
        ForeignKey("network_sites.id", ondelete="RESTRICT"), nullable=False
    )
    alarm_code: Mapped[str] = mapped_column(String(64), nullable=False)
    severity: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now
    )
    region: Mapped[str | None] = mapped_column(String(64))
    source: Mapped[str | None] = mapped_column(String(64))
    scenario_id: Mapped[str | None] = mapped_column(String(64))
    correlation_key: Mapped[str | None] = mapped_column(String(128))
    site_name: Mapped[str | None] = mapped_column(String(128))
    technology: Mapped[str | None] = mapped_column(String(32))
    vendor: Mapped[str | None] = mapped_column(String(64))
    network_component: Mapped[str | None] = mapped_column(String(64))
    source_severity: Mapped[str | None] = mapped_column(String(32))
    computed_severity: Mapped[str | None] = mapped_column(String(32))
    severity_rule: Mapped[str | None] = mapped_column(String(64))
    latency_ms: Mapped[float | None] = mapped_column(Float)
    throughput_mbps: Mapped[float | None] = mapped_column(Float)
    utilization_pct: Mapped[float | None] = mapped_column(Float)
    dropped_call_rate_pct: Mapped[float | None] = mapped_column(Float)
    synthetic: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    site: Mapped[NetworkSiteRow] = relationship(back_populates="alarms")
    incident_links: Mapped[list[IncidentAlarmRow]] = relationship(back_populates="alarm")


class TelemetryMetricRow(Base):
    __tablename__ = "telemetry_metrics"
    __table_args__ = (
        UniqueConstraint("metric_id", name="uq_telemetry_metrics_metric_id"),
        CheckConstraint(
            "state IN ('normal', 'abnormal')",
            name="ck_telemetry_metrics_state",
        ),
        Index("ix_telemetry_metrics_site_id_recorded_at", "site_id", "recorded_at"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    metric_id: Mapped[str] = mapped_column(String(64), nullable=False)
    site_id: Mapped[UUID] = mapped_column(
        ForeignKey("network_sites.id", ondelete="RESTRICT"), nullable=False
    )
    latency_ms: Mapped[float] = mapped_column(Float, nullable=False)
    throughput_mbps: Mapped[float] = mapped_column(Float, nullable=False)
    utilization_pct: Mapped[float] = mapped_column(Float, nullable=False)
    dropped_call_rate_pct: Mapped[float] = mapped_column(Float, nullable=False)
    sample_window_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    state: Mapped[str] = mapped_column(String(32), nullable=False, default="normal")
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now
    )
    synthetic: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    site: Mapped[NetworkSiteRow] = relationship(back_populates="metrics")


class DeploymentRow(Base):
    __tablename__ = "deployments"
    __table_args__ = (
        UniqueConstraint("deployment_id", name="uq_deployments_deployment_id"),
        CheckConstraint(
            "change_type IN ('software', 'configuration')",
            name="ck_deployments_change_type",
        ),
        CheckConstraint(
            "status IN ('in_progress', 'completed', 'completed_with_warning', "
            "'failed', 'rolled_back')",
            name="ck_deployments_status",
        ),
        Index("ix_deployments_site_id_started_at", "site_id", "started_at"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    deployment_id: Mapped[str] = mapped_column(String(64), nullable=False)
    site_id: Mapped[UUID] = mapped_column(
        ForeignKey("network_sites.id", ondelete="RESTRICT"), nullable=False
    )
    change_type: Mapped[str] = mapped_column(String(32), nullable=False)
    version_before: Mapped[str] = mapped_column(String(64), nullable=False)
    version_after: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    notes: Mapped[str] = mapped_column(Text, nullable=False)
    change_ticket: Mapped[str | None] = mapped_column(String(64))
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now
    )
    synthetic: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    site: Mapped[NetworkSiteRow] = relationship(back_populates="deployments")


class IncidentRow(Base):
    __tablename__ = "incidents"
    __table_args__ = (
        UniqueConstraint("incident_id", name="uq_incidents_incident_id"),
        CheckConstraint(
            "severity IN ('critical', 'major', 'minor', 'warning', 'info', 'cleared')",
            name="ck_incidents_severity",
        ),
        CheckConstraint(
            "status IN ('OPEN', 'INVESTIGATING', 'AWAITING_APPROVAL', 'CLOSED')",
            name="ck_incidents_status",
        ),
        Index("ix_incidents_site_id_status", "site_id", "status"),
        Index("ix_incidents_severity_opened_at", "severity", "opened_at"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    incident_id: Mapped[str] = mapped_column(String(64), nullable=False)
    site_id: Mapped[UUID] = mapped_column(
        ForeignKey("network_sites.id", ondelete="RESTRICT"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(256), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    severity: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    priority: Mapped[str | None] = mapped_column(String(8))
    scenario_id: Mapped[str | None] = mapped_column(String(64))
    opened_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now, onupdate=utc_now
    )
    synthetic: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    site: Mapped[NetworkSiteRow] = relationship(back_populates="incidents")
    alarm_links: Mapped[list[IncidentAlarmRow]] = relationship(back_populates="incident")
    investigations: Mapped[list[InvestigationResultRow]] = relationship(
        back_populates="incident"
    )
    runbooks: Mapped[list[RunbookReferenceRow]] = relationship(back_populates="incident")
    remediations: Mapped[list[RemediationActionRow]] = relationship(
        back_populates="incident"
    )
    audit_events: Mapped[list[AuditEventRow]] = relationship(back_populates="incident")


class IncidentAlarmRow(Base):
    __tablename__ = "incident_alarms"
    __table_args__ = (
        UniqueConstraint("incident_id", "alarm_id", name="uq_incident_alarms_pair"),
        Index("ix_incident_alarms_alarm_id", "alarm_id"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    incident_id: Mapped[UUID] = mapped_column(
        ForeignKey("incidents.id", ondelete="RESTRICT"), nullable=False
    )
    alarm_id: Mapped[UUID] = mapped_column(
        ForeignKey("network_alarms.id", ondelete="RESTRICT"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now
    )

    incident: Mapped[IncidentRow] = relationship(back_populates="alarm_links")
    alarm: Mapped[NetworkAlarmRow] = relationship(back_populates="incident_links")


class InvestigationResultRow(Base):
    __tablename__ = "investigation_results"
    __table_args__ = (
        UniqueConstraint("investigation_id", name="uq_investigation_results_investigation_id"),
        Index("ix_investigation_results_incident_id_created_at", "incident_id", "created_at"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    investigation_id: Mapped[str] = mapped_column(String(64), nullable=False)
    incident_id: Mapped[UUID] = mapped_column(
        ForeignKey("incidents.id", ondelete="RESTRICT"), nullable=False
    )
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    findings: Mapped[str] = mapped_column(Text, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    method: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now
    )

    incident: Mapped[IncidentRow] = relationship(back_populates="investigations")


class RunbookReferenceRow(Base):
    __tablename__ = "runbook_references"
    __table_args__ = (
        UniqueConstraint("reference_id", name="uq_runbook_references_reference_id"),
        Index("ix_runbook_references_incident_id", "incident_id"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    reference_id: Mapped[str] = mapped_column(String(64), nullable=False)
    incident_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("incidents.id", ondelete="SET NULL")
    )
    title: Mapped[str] = mapped_column(String(256), nullable=False)
    source_uri: Mapped[str] = mapped_column(String(512), nullable=False)
    document_id: Mapped[str | None] = mapped_column(String(64))
    relevance_score: Mapped[float | None] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now
    )

    incident: Mapped[IncidentRow | None] = relationship(back_populates="runbooks")


class RemediationActionRow(Base):
    __tablename__ = "remediation_actions"
    __table_args__ = (
        UniqueConstraint("action_id", name="uq_remediation_actions_action_id"),
        CheckConstraint(
            "status IN ('proposed', 'pending', 'approved', 'rejected', 'executed')",
            name="ck_remediation_actions_status",
        ),
        Index("ix_remediation_actions_incident_id_status", "incident_id", "status"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    action_id: Mapped[str] = mapped_column(String(64), nullable=False)
    incident_id: Mapped[UUID] = mapped_column(
        ForeignKey("incidents.id", ondelete="RESTRICT"), nullable=False
    )
    action_type: Mapped[str] = mapped_column(String(64), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="proposed")
    proposed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    executed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now
    )

    incident: Mapped[IncidentRow] = relationship(back_populates="remediations")


class AuditEventRow(Base):
    __tablename__ = "audit_events"
    __table_args__ = (
        UniqueConstraint("event_id", name="uq_audit_events_event_id"),
        Index("ix_audit_events_incident_id_created_at", "incident_id", "created_at"),
        Index("ix_audit_events_event_type_created_at", "event_type", "created_at"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    event_id: Mapped[str] = mapped_column(String(64), nullable=False)
    incident_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("incidents.id", ondelete="SET NULL")
    )
    event_type: Mapped[str] = mapped_column(String(64), nullable=False)
    actor: Mapped[str] = mapped_column(String(128), nullable=False)
    details: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now
    )

    incident: Mapped[IncidentRow | None] = relationship(back_populates="audit_events")


REQUIRED_TABLES = (
    "network_sites",
    "network_alarms",
    "telemetry_metrics",
    "deployments",
    "incidents",
    "incident_alarms",
    "investigation_results",
    "runbook_references",
    "remediation_actions",
    "audit_events",
)

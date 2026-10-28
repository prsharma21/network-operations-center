"""SQLAlchemy OSS repository. Equipment, topology, and tickets stay on JSON."""

from __future__ import annotations

import re
from datetime import datetime
from typing import Any
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.db.models import (
    DeploymentRow,
    IncidentAlarmRow,
    IncidentRow,
    NetworkAlarmRow,
    NetworkSiteRow,
    TelemetryMetricRow,
)
from app.services.alarm_fingerprint import fingerprint_from_record
from oss_api.exceptions import DuplicateAlarm, DuplicateMetric
from oss_api.repository import JsonOssRepository

_ALARM_ID_PATTERN = re.compile(r"^ALM-(\d+)$", re.IGNORECASE)
_METRIC_ID_PATTERN = re.compile(r"^MET-(\d+)$", re.IGNORECASE)


class SqlAlchemyOssRepository:
    """Duck-types the JSON repository for sites, alarms, telemetry, deployments, incidents."""

    def __init__(self, session: Session, inventory: JsonOssRepository) -> None:
        self._session = session
        self._inventory = inventory

    def get_site_record(self, site_id: str) -> dict[str, Any] | None:
        row = self._session.scalar(
            select(NetworkSiteRow).where(NetworkSiteRow.site_id == site_id.strip())
        )
        return _site_to_record(row) if row is not None else None

    def list_site_records(self) -> list[dict[str, Any]]:
        rows = self._session.scalars(
            select(NetworkSiteRow).order_by(NetworkSiteRow.site_id)
        ).all()
        return [_site_to_record(row) for row in rows]

    def list_equipment(self, site_id: str) -> list[dict[str, Any]]:
        return self._inventory.list_equipment(site_id)

    def list_topology(self, site_id: str) -> list[dict[str, Any]]:
        return self._inventory.list_topology(site_id)

    def list_alarm_records(self) -> list[dict[str, Any]]:
        rows = self._session.scalars(
            select(NetworkAlarmRow).options(joinedload(NetworkAlarmRow.site))
        ).unique().all()
        return [_alarm_to_record(row) for row in rows]

    def get_alarm_record(self, alarm_id: str) -> dict[str, Any] | None:
        row = self._session.scalar(
            select(NetworkAlarmRow)
            .options(joinedload(NetworkAlarmRow.site))
            .where(NetworkAlarmRow.alarm_id == alarm_id)
        )
        return _alarm_to_record(row) if row is not None else None

    def add_alarm_record(
        self,
        record: dict[str, Any],
        fingerprint: str | None = None,
    ) -> dict[str, Any]:
        site = self._session.scalar(
            select(NetworkSiteRow).where(NetworkSiteRow.site_id == str(record["site_id"]))
        )
        if site is None:
            raise LookupError(record["site_id"])
        alarm_id = str(record.get("alarm_id") or "").strip()
        if not alarm_id:
            alarm_id = self.next_alarm_id()
        occurred = _as_datetime(record["timestamp"])
        row = NetworkAlarmRow(
            id=uuid4(),
            alarm_id=alarm_id,
            source_event_id=record.get("source_event_id") or alarm_id,
            fingerprint=fingerprint or fingerprint_from_record({**record, "alarm_id": alarm_id}),
            site_id=site.id,
            alarm_code=record["alarm_code"],
            severity=record["severity"] if not hasattr(record["severity"], "value") else record["severity"].value,
            status=record["status"] if not hasattr(record["status"], "value") else record["status"].value,
            message=record["message"],
            occurred_at=occurred,
            created_at=occurred,
            region=record.get("region") or site.region,
            source=record.get("source"),
            scenario_id=record.get("scenario_id"),
            correlation_key=record.get("correlation_key"),
            site_name=record.get("site_name") or site.name,
            technology=record.get("technology") or site.technology,
            vendor=record.get("vendor") or site.vendor,
            network_component=record.get("network_component"),
            source_severity=_enum_value(record.get("source_severity")),
            computed_severity=_enum_value(record.get("computed_severity")),
            severity_rule=record.get("severity_rule"),
            latency_ms=record.get("latency_ms"),
            throughput_mbps=record.get("throughput_mbps"),
            utilization_pct=record.get("utilization_pct"),
            dropped_call_rate_pct=record.get("dropped_call_rate_pct"),
            synthetic=bool(record.get("synthetic", True)),
        )
        self._session.add(row)
        try:
            self._session.flush()
        except IntegrityError as exc:
            self._session.rollback()
            raise _duplicate_alarm(exc, alarm_id) from exc
        row.site = site
        return _alarm_to_record(row)

    def next_alarm_id(self) -> str:
        ids = self._session.scalars(select(NetworkAlarmRow.alarm_id)).all()
        highest = 0
        for alarm_id in ids:
            match = _ALARM_ID_PATTERN.match(alarm_id)
            if match:
                highest = max(highest, int(match.group(1)))
        return f"ALM-{highest + 1:04d}"

    def list_metric_records(self) -> list[dict[str, Any]]:
        rows = self._session.scalars(
            select(TelemetryMetricRow).options(joinedload(TelemetryMetricRow.site))
        ).unique().all()
        return [_metric_to_record(row) for row in rows]

    def get_metric_record(self, metric_id: str) -> dict[str, Any] | None:
        row = self._session.scalar(
            select(TelemetryMetricRow)
            .options(joinedload(TelemetryMetricRow.site))
            .where(TelemetryMetricRow.metric_id == metric_id)
        )
        return _metric_to_record(row) if row is not None else None

    def add_metric_record(self, record: dict[str, Any]) -> dict[str, Any]:
        site = self._session.scalar(
            select(NetworkSiteRow).where(NetworkSiteRow.site_id == str(record["site_id"]))
        )
        if site is None:
            raise LookupError(record["site_id"])
        recorded = _as_datetime(record["timestamp"])
        row = TelemetryMetricRow(
            id=uuid4(),
            metric_id=str(record["metric_id"]),
            site_id=site.id,
            latency_ms=float(record["latency_ms"]),
            throughput_mbps=float(record["throughput_mbps"]),
            utilization_pct=float(record["utilization_pct"]),
            dropped_call_rate_pct=float(record["dropped_call_rate_pct"]),
            sample_window_minutes=int(record.get("sample_window_minutes") or 5),
            state=_enum_value(record.get("state")) or "normal",
            recorded_at=recorded,
            created_at=recorded,
            synthetic=bool(record.get("synthetic", True)),
        )
        self._session.add(row)
        try:
            self._session.flush()
        except IntegrityError as exc:
            self._session.rollback()
            raise DuplicateMetric(str(record["metric_id"])) from exc
        row.site = site
        return _metric_to_record(row)

    def next_metric_id(self) -> str:
        ids = self._session.scalars(select(TelemetryMetricRow.metric_id)).all()
        highest = 0
        for metric_id in ids:
            match = _METRIC_ID_PATTERN.match(metric_id)
            if match:
                highest = max(highest, int(match.group(1)))
        return f"MET-{highest + 1:05d}"

    def list_deployment_records(self) -> list[dict[str, Any]]:
        rows = self._session.scalars(
            select(DeploymentRow).options(joinedload(DeploymentRow.site))
        ).unique().all()
        return [_deployment_to_record(row) for row in rows]

    def list_ticket_records(self) -> list[dict[str, Any]]:
        return self._inventory.list_ticket_records()

    def list_incident_records(self) -> list[dict[str, Any]]:
        rows = self._session.scalars(
            select(IncidentRow).options(
                joinedload(IncidentRow.site),
                joinedload(IncidentRow.alarm_links).joinedload(IncidentAlarmRow.alarm),
            )
        ).unique().all()
        return [_incident_to_record(row) for row in rows]

    def get_incident_record(self, incident_id: str) -> dict[str, Any] | None:
        row = self._session.scalar(
            select(IncidentRow)
            .options(
                joinedload(IncidentRow.site),
                joinedload(IncidentRow.alarm_links).joinedload(IncidentAlarmRow.alarm),
            )
            .where(IncidentRow.incident_id == incident_id.strip())
        )
        return _incident_to_record(row) if row is not None else None


def _site_to_record(row: NetworkSiteRow) -> dict[str, Any]:
    return {
        "site_id": row.site_id,
        "site_name": row.name,
        "region": row.region,
        "technology": row.technology,
        "vendor": row.vendor,
        "status": row.status,
        "latitude": row.latitude,
        "longitude": row.longitude,
        "site_type": row.site_type,
        "criticality": row.criticality,
        "backhaul_type": row.backhaul_type,
        "known_scenario": row.known_scenario,
        "synthetic": row.synthetic,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


def _alarm_to_record(row: NetworkAlarmRow) -> dict[str, Any]:
    site = row.site
    return {
        "alarm_id": row.alarm_id,
        "site_id": site.site_id if site is not None else "",
        "alarm_code": row.alarm_code,
        "severity": row.severity,
        "status": row.status,
        "timestamp": row.occurred_at.isoformat(),
        "message": row.message,
        "region": row.region or (site.region if site is not None else None),
        "source": row.source,
        "scenario_id": row.scenario_id,
        "correlation_key": row.correlation_key,
        "synthetic": row.synthetic,
        "source_event_id": row.source_event_id,
        "site_name": row.site_name or (site.name if site is not None else None),
        "technology": row.technology or (site.technology if site is not None else None),
        "vendor": row.vendor or (site.vendor if site is not None else None),
        "network_component": row.network_component,
        "source_severity": row.source_severity,
        "computed_severity": row.computed_severity,
        "severity_rule": row.severity_rule,
        "latency_ms": row.latency_ms,
        "throughput_mbps": row.throughput_mbps,
        "utilization_pct": row.utilization_pct,
        "dropped_call_rate_pct": row.dropped_call_rate_pct,
    }


def _metric_to_record(row: TelemetryMetricRow) -> dict[str, Any]:
    return {
        "metric_id": row.metric_id,
        "site_id": row.site.site_id if row.site is not None else "",
        "timestamp": row.recorded_at.isoformat(),
        "latency_ms": row.latency_ms,
        "throughput_mbps": row.throughput_mbps,
        "utilization_pct": row.utilization_pct,
        "dropped_call_rate_pct": row.dropped_call_rate_pct,
        "sample_window_minutes": row.sample_window_minutes,
        "state": row.state,
        "synthetic": row.synthetic,
    }


def _deployment_to_record(row: DeploymentRow) -> dict[str, Any]:
    return {
        "deployment_id": row.deployment_id,
        "site_id": row.site.site_id if row.site is not None else "",
        "timestamp": row.started_at.isoformat(),
        "change_type": row.change_type,
        "version_before": row.version_before,
        "version_after": row.version_after,
        "status": row.status,
        "notes": row.notes,
        "change_ticket": row.change_ticket,
        "synthetic": row.synthetic,
    }


def _incident_to_record(row: IncidentRow) -> dict[str, Any]:
    public_site = row.site.site_id if row.site is not None else ""
    alarm_ids = [
        link.alarm.alarm_id
        for link in row.alarm_links
        if link.alarm is not None
    ]
    return {
        "incident_id": row.incident_id,
        "title": row.title,
        "description": row.description,
        "severity": row.severity,
        "status": row.status,
        "site_id": public_site,
        "site_name": row.site.name if row.site is not None else None,
        "affected_sites": [public_site] if public_site else [],
        "scenario_id": row.scenario_id,
        "priority": row.priority,
        "evidence_alarm_ids": alarm_ids,
        "created_at": row.opened_at.isoformat(),
        "updated_at": row.updated_at.isoformat(),
        "synthetic": row.synthetic,
    }


def _as_datetime(value: object) -> datetime:
    if isinstance(value, datetime):
        return value
    from app.utils.timestamps import parse_utc_datetime

    return parse_utc_datetime(str(value))


def _enum_value(value: object) -> str | None:
    if value is None:
        return None
    raw = getattr(value, "value", value)
    return str(raw) if raw is not None else None


def _duplicate_alarm(exc: IntegrityError, alarm_id: str) -> DuplicateAlarm:
    message = str(getattr(exc, "orig", exc)).lower()
    if "fingerprint" in message:
        return DuplicateAlarm(alarm_id, reason="fingerprint")
    if "source_event_id" in message:
        return DuplicateAlarm(alarm_id, reason="alarm_id")
    return DuplicateAlarm(alarm_id)

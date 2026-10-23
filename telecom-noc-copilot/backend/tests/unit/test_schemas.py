from __future__ import annotations

from datetime import UTC, datetime

import pytest
from pydantic import ValidationError

from app.schemas import (
    DeploymentEvent,
    Incident,
    IncidentCreate,
    NetworkAlarm,
    NetworkAlarmCreate,
    NetworkSite,
    TelemetryMetric,
    TelemetryMetricCreate,
    Ticket,
)
from app.schemas.enums import IncidentLifecycleStatus, Severity


def valid_site(**overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "site_id": "SITE-003",
        "site_name": "East-CELL-003",
        "region": "East",
        "technology": "4G+5G",
        "vendor": "Nokia",
        "status": "degraded",
        "latitude": 22.62364,
        "longitude": 82.31183,
        "site_type": "macro",
        "criticality": "low",
        "backhaul_type": "microwave",
        "synthetic": True,
    }
    payload.update(overrides)
    return payload


def valid_alarm(**overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "alarm_id": "ALM-0001",
        "timestamp": "2026-10-19T01:13:00+00:00",
        "site_id": "SITE-003",
        "region": "East",
        "alarm_code": "SITE_UNREACHABLE",
        "severity": "critical",
        "status": "active",
        "source": "synthetic-oss",
        "message": "Backhaul path unreachable",
        "synthetic": True,
    }
    payload.update(overrides)
    return payload


def valid_metric(**overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "metric_id": "MET-00001",
        "timestamp": "2026-10-19T00:00:00+00:00",
        "site_id": "SITE-001",
        "latency_ms": 20.78,
        "throughput_mbps": 143.04,
        "utilization_pct": 24.56,
        "dropped_call_rate_pct": 0.43,
        "sample_window_minutes": 5,
        "state": "normal",
        "synthetic": True,
    }
    payload.update(overrides)
    return payload


def valid_deployment(**overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "deployment_id": "DEP-001",
        "site_id": "SITE-012",
        "timestamp": "2026-10-19T04:00:00+00:00",
        "change_type": "software",
        "version_before": "R20.4",
        "version_after": "R21.1",
        "status": "completed_with_warning",
        "change_ticket": "CHG-0001",
        "notes": "Synthetic configuration rollout",
        "synthetic": True,
    }
    payload.update(overrides)
    return payload


def valid_incident(**overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "incident_id": "INC-OUTAGE-001",
        "title": "Site unreachable at SITE-003",
        "severity": "critical",
        "status": "OPEN",
        "affected_sites": ["SITE-003"],
        "created_at": "2026-10-19T02:00:00+00:00",
        "updated_at": "2026-10-19T02:15:00+00:00",
        "scenario_id": "SCN-OUTAGE-01",
        "priority": "P1",
    }
    payload.update(overrides)
    return payload


def valid_ticket(**overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "ticket_id": "TKT-0001",
        "created_at": "2026-10-19T02:00:00+00:00",
        "site_id": "SITE-003",
        "title": "Investigate site unreachable",
        "priority": "P1",
        "status": "open",
        "assigned_group": "NOC-L2",
        "description": "Synthetic training ticket.",
        "synthetic": True,
    }
    payload.update(overrides)
    return payload


def test_valid_examples_pass_validation() -> None:
    assert NetworkSite.model_validate(valid_site()).site_id == "SITE-003"
    assert NetworkAlarm.model_validate(valid_alarm()).severity is Severity.CRITICAL
    metric = TelemetryMetric.model_validate(valid_metric())
    assert metric.utilization_pct == 24.56
    assert DeploymentEvent.model_validate(valid_deployment()).deployment_id == "DEP-001"
    incident = Incident.model_validate(valid_incident())
    assert incident.status is IncidentLifecycleStatus.OPEN
    assert incident.created_at == datetime(2026, 10, 19, 2, 0, tzinfo=UTC)
    assert Ticket.model_validate(valid_ticket()).priority.value == "P1"


def test_missing_required_fields_fail() -> None:
    with pytest.raises(ValidationError):
        NetworkSite.model_validate({"site_id": "SITE-001"})
    with pytest.raises(ValidationError):
        NetworkAlarm.model_validate({"alarm_id": "ALM-1"})
    with pytest.raises(ValidationError):
        TelemetryMetric.model_validate({"metric_id": "MET-1"})
    with pytest.raises(ValidationError):
        DeploymentEvent.model_validate({"deployment_id": "DEP-1"})
    with pytest.raises(ValidationError):
        Incident.model_validate({"incident_id": "INC-1"})
    with pytest.raises(ValidationError):
        Ticket.model_validate({"ticket_id": "TKT-1"})


def test_blank_strings_are_rejected() -> None:
    with pytest.raises(ValidationError):
        NetworkSite.model_validate(valid_site(site_name="   "))
    with pytest.raises(ValidationError):
        NetworkAlarm.model_validate(valid_alarm(message=""))


def test_alarm_create_allows_omitted_id() -> None:
    created = NetworkAlarmCreate.model_validate(
        {
            "site_id": "SITE-001",
            "alarm_code": "HIGH_LATENCY",
            "severity": "major",
            "status": "active",
            "timestamp": "2026-10-21T12:00:00+00:00",
            "message": "Latency above threshold",
        }
    )
    assert created.alarm_id is None
    assert created.site_id == "SITE-001"


def test_invalid_severity_and_status_are_rejected() -> None:
    with pytest.raises(ValidationError):
        NetworkAlarm.model_validate(valid_alarm(severity="catastrophic"))
    with pytest.raises(ValidationError):
        NetworkAlarm.model_validate(valid_alarm(status="OPEN"))
    with pytest.raises(ValidationError):
        Incident.model_validate(valid_incident(status="active"))
    with pytest.raises(ValidationError):
        Ticket.model_validate(valid_ticket(status="INVESTIGATING"))


def test_incident_lifecycle_accepts_case_insensitive_values() -> None:
    created = IncidentCreate.model_validate(
        {
            "title": "Congestion at SITE-007",
            "severity": "MAJOR",
            "status": "investigating",
            "site_id": "SITE-007",
        }
    )
    assert created.status is IncidentLifecycleStatus.INVESTIGATING
    assert created.affected_sites == ["SITE-007"]


def test_aliases_accept_task_field_names() -> None:
    alarm = NetworkAlarm.model_validate(
        {
            "alarm_id": "ALM-0005",
            "timestamp": "2026-10-19T08:37:00+00:00",
            "site_id": "SITE-007",
            "alarm_type": "HIGH_LATENCY",
            "severity": "major",
            "status": "active",
            "description": "Latency above 150 ms",
        }
    )
    assert alarm.alarm_code == "HIGH_LATENCY"
    assert alarm.message == "Latency above 150 ms"

    metric = TelemetryMetric.model_validate(
        {
            "metric_id": "MET-9",
            "timestamp": "2026-10-19T00:00:00Z",
            "site_id": "SITE-001",
            "latency_ms": 10,
            "throughput_mbps": 100,
            "utilization_pct": 40,
            "dropped_call_rate": 1.5,
        }
    )
    assert metric.dropped_call_rate_pct == 1.5


def test_telemetry_create_allows_omitted_id_and_alias() -> None:
    created = TelemetryMetricCreate.model_validate(
        {
            "site_id": "SITE-001",
            "timestamp": "2026-10-21T12:00:00+00:00",
            "latency_ms": 18.5,
            "throughput_mbps": 150.0,
            "utilization_pct": 32.0,
            "dropped_call_rate": 0.4,
        }
    )
    assert created.metric_id is None
    assert created.dropped_call_rate_pct == 0.4


def test_invalid_kpi_ranges_are_rejected() -> None:
    with pytest.raises(ValidationError):
        TelemetryMetric.model_validate(valid_metric(latency_ms=-1))
    with pytest.raises(ValidationError):
        TelemetryMetric.model_validate(valid_metric(throughput_mbps=-0.01))
    with pytest.raises(ValidationError):
        TelemetryMetric.model_validate(valid_metric(utilization_pct=150))
    with pytest.raises(ValidationError):
        TelemetryMetric.model_validate(valid_metric(dropped_call_rate_pct=-2))
    with pytest.raises(ValidationError):
        TelemetryMetric.model_validate(valid_metric(utilization_pct=-1))


def test_outage_kpi_sentinel_is_accepted() -> None:
    metric = TelemetryMetric.model_validate(
        valid_metric(
            latency_ms=999.0,
            throughput_mbps=0.0,
            utilization_pct=0.0,
            dropped_call_rate_pct=100.0,
        )
    )
    assert metric.latency_ms == 999.0

from __future__ import annotations

from pathlib import Path

import pytest

from oss_api.exceptions import DuplicateAlarm, DuplicateMetric, SiteNotFound
from oss_api.repository import JsonOssRepository
from oss_api.service import OssSiteService


def test_json_repository_returns_existing_site(data_dir: Path) -> None:
    repo = JsonOssRepository(data_dir)
    record = repo.get_site_record("SITE-001")
    assert record is not None
    assert record["site_name"] == "North-CELL-001"
    assert repo.list_equipment("SITE-001")
    assert repo.list_topology("SITE-001")


def test_json_repository_does_not_invent_unknown_sites(data_dir: Path) -> None:
    repo = JsonOssRepository(data_dir)
    assert repo.get_site_record("SITE-UNKNOWN") is None
    assert repo.list_equipment("SITE-UNKNOWN") == []


def test_service_raises_not_found_for_unknown_site(data_dir: Path) -> None:
    service = OssSiteService(JsonOssRepository(data_dir))
    with pytest.raises(SiteNotFound) as exc:
        service.get_site("SITE-UNKNOWN")
    assert exc.value.site_id == "SITE-UNKNOWN"


def test_repository_loads_alarms_and_assigns_next_id(data_dir: Path) -> None:
    repo = JsonOssRepository(data_dir)
    assert repo.get_alarm_record("ALM-0001") is not None
    assert repo.get_alarm_record("ALM-0101") is None
    assert len(repo.list_alarm_records()) == 100
    assert repo.next_alarm_id() == "ALM-0101"


def test_repository_rejects_duplicate_alarm_without_overwrite(data_dir: Path) -> None:
    repo = JsonOssRepository(data_dir)
    original = repo.get_alarm_record("ALM-0001")
    assert original is not None
    with pytest.raises(DuplicateAlarm) as exc:
        repo.add_alarm_record({**original, "message": "overwrite attempt"})
    assert exc.value.alarm_id == "ALM-0001"
    assert repo.get_alarm_record("ALM-0001")["message"] == original["message"]


def test_repository_stores_posted_alarm_in_memory(data_dir: Path) -> None:
    repo = JsonOssRepository(data_dir)
    stored = repo.add_alarm_record(
        {
            "alarm_id": "ALM-0101",
            "site_id": "SITE-001",
            "alarm_code": "HIGH_LATENCY",
            "severity": "major",
            "status": "active",
            "timestamp": "2026-10-21T12:00:00+00:00",
            "message": "In-memory overlay",
        }
    )
    assert stored["alarm_id"] == "ALM-0101"
    assert repo.get_alarm_record("ALM-0101")["message"] == "In-memory overlay"
    assert len(repo.list_alarm_records()) == 101


def test_repository_loads_metrics_and_assigns_next_id(data_dir: Path) -> None:
    repo = JsonOssRepository(data_dir)
    assert repo.get_metric_record("MET-00001") is not None
    assert repo.get_metric_record("MET-00241") is None
    assert len(repo.list_metric_records()) == 240
    assert repo.next_metric_id() == "MET-00241"


def test_repository_rejects_duplicate_metric_without_overwrite(data_dir: Path) -> None:
    repo = JsonOssRepository(data_dir)
    original = repo.get_metric_record("MET-00001")
    assert original is not None
    with pytest.raises(DuplicateMetric) as exc:
        repo.add_metric_record({**original, "latency_ms": 1.0})
    assert exc.value.metric_id == "MET-00001"
    assert repo.get_metric_record("MET-00001")["latency_ms"] == original["latency_ms"]


def test_repository_stores_posted_metric_in_memory(data_dir: Path) -> None:
    repo = JsonOssRepository(data_dir)
    stored = repo.add_metric_record(
        {
            "metric_id": "MET-00241",
            "site_id": "SITE-001",
            "timestamp": "2026-10-21T12:00:00+00:00",
            "latency_ms": 18.5,
            "throughput_mbps": 150.0,
            "utilization_pct": 32.0,
            "dropped_call_rate_pct": 0.4,
        }
    )
    assert stored["metric_id"] == "MET-00241"
    assert repo.get_metric_record("MET-00241")["latency_ms"] == 18.5
    assert len(repo.list_metric_records()) == 241


def test_repository_loads_deployments_and_tickets(data_dir: Path) -> None:
    repo = JsonOssRepository(data_dir)
    deployments = repo.list_deployment_records()
    tickets = repo.list_ticket_records()
    assert len(deployments) == 6
    assert len(tickets) == 15
    assert {item["deployment_id"] for item in deployments} >= {"DEP-001", "DEP-006"}
    assert {item["ticket_id"] for item in tickets} >= {"TKT-0001", "TKT-0015"}
    assert all("incident_id" not in item or item["incident_id"] is None for item in tickets)

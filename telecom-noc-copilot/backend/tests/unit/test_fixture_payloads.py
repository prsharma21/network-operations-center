from __future__ import annotations

import json
from pathlib import Path

from app.schemas import DeploymentEvent, NetworkAlarm, NetworkSite, TelemetryMetric, Ticket
from app.schemas.incident import GroundTruthIncident


def _load(data_dir: Path, relative: str, key: str) -> list[dict]:
    payload = json.loads((data_dir / relative).read_text(encoding="utf-8"))
    records = payload[key]
    assert isinstance(records, list) and records
    return records


def test_synthetic_sites_match_schema(data_dir: Path) -> None:
    for row in _load(data_dir, "sites/sites.json", "sites"):
        NetworkSite.model_validate(row)


def test_synthetic_alarms_match_schema(data_dir: Path) -> None:
    for row in _load(data_dir, "alarms/alarms.json", "alarms"):
        NetworkAlarm.model_validate(row)


def test_synthetic_telemetry_match_schema(data_dir: Path) -> None:
    for row in _load(data_dir, "telemetry/telemetry_metrics.json", "metrics"):
        TelemetryMetric.model_validate(row)


def test_synthetic_deployments_match_schema(data_dir: Path) -> None:
    for row in _load(data_dir, "deployments/deployment_events.json", "deployment_events"):
        DeploymentEvent.model_validate(row)


def test_synthetic_tickets_match_schema(data_dir: Path) -> None:
    for row in _load(data_dir, "tickets/tickets.json", "tickets"):
        Ticket.model_validate(row)


def test_ground_truth_incidents_match_evaluation_schema(data_dir: Path) -> None:
    for row in _load(data_dir, "ground_truth/expected_incidents.json", "incidents"):
        GroundTruthIncident.model_validate(row)

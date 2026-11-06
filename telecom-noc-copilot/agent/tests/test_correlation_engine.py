from __future__ import annotations

import json
from pathlib import Path

from agent.services.correlation.engine import AlarmCorrelationEngine
from agent.services.correlation.models import ExistingIncident

ROOT = Path(__file__).resolve().parents[2]
ALARMS_PATH = ROOT / "data" / "alarms" / "alarms.json"
GROUND_TRUTH_PATH = ROOT / "data" / "ground_truth" / "expected_incidents.json"


def _load_alarms() -> list[dict]:
    return json.loads(ALARMS_PATH.read_text(encoding="utf-8"))["alarms"]


def _load_ground_truth() -> list[dict]:
    return json.loads(GROUND_TRUTH_PATH.read_text(encoding="utf-8"))["incidents"]


def test_groups_by_site_component_and_time_window() -> None:
    engine = AlarmCorrelationEngine()
    result = engine.correlate(_load_alarms())
    assert result.groups_evaluated >= 3
    assert result.created_count >= 3


def test_ground_truth_scenarios_are_correlated() -> None:
    engine = AlarmCorrelationEngine()
    result = engine.correlate(_load_alarms())
    by_id = {item.incident_id: item for item in result.incidents if not item.is_duplicate}

    for expected in _load_ground_truth():
        incident = by_id[expected["incident_id"]]
        assert incident.site_id == expected["site_id"]
        assert incident.scenario_id == expected["scenario_id"]
        assert set(incident.evidence_alarm_ids) == set(expected["evidence_alarm_ids"])
        assert incident.expected_cause == expected["expected_cause"]
        assert incident.priority in {"P1", "P2"}
        assert incident.severity in {"critical", "major"}


def test_duplicate_incidents_are_suppressed() -> None:
    engine = AlarmCorrelationEngine()
    first = engine.correlate(_load_alarms())
    created = [item for item in first.incidents if not item.is_duplicate]
    assert created

    existing = [
        ExistingIncident(
            incident_id=item.incident_id,
            site_id=item.site_id,
            status="OPEN",
            scenario_id=item.scenario_id,
            evidence_alarm_ids=list(item.evidence_alarm_ids),
            correlation_fingerprint=item.correlation_fingerprint,
        )
        for item in created
    ]
    second = engine.correlate(_load_alarms(), existing_incidents=existing)
    scenario_ids = {row["incident_id"] for row in _load_ground_truth()}
    for item in second.incidents:
        if item.incident_id in scenario_ids:
            assert item.is_duplicate is True
            assert item.duplicate_of


def test_severity_and_priority_rules_outage_is_p1() -> None:
    engine = AlarmCorrelationEngine()
    alarms = [row for row in _load_alarms() if row.get("scenario_id") == "SCN-OUTAGE-01"]
    result = engine.correlate(alarms)
    assert len(result.incidents) == 1
    incident = result.incidents[0]
    assert incident.severity == "critical"
    assert incident.priority == "P1"
    assert incident.component == "backhaul"


def test_cleared_alarms_are_skipped() -> None:
    engine = AlarmCorrelationEngine()
    alarms = [
        {
            "alarm_id": "ALM-X1",
            "site_id": "SITE-003",
            "alarm_code": "SITE_UNREACHABLE",
            "severity": "critical",
            "status": "cleared",
            "timestamp": "2026-10-19T01:00:00+00:00",
            "message": "cleared",
            "region": "North",
        },
        {
            "alarm_id": "ALM-X2",
            "site_id": "SITE-003",
            "alarm_code": "BACKHAUL_LINK_DOWN",
            "severity": "critical",
            "status": "cleared",
            "timestamp": "2026-10-19T01:05:00+00:00",
            "message": "cleared",
            "region": "North",
        },
    ]
    result = engine.correlate(alarms)
    assert result.created_count == 0
    assert result.skipped_cleared_count == 2

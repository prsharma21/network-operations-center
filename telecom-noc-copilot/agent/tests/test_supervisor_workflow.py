from __future__ import annotations

import json
from pathlib import Path

from agent.runtime.graph import run_investigation
from agent.nodes.supervisor import decide_next_action
from agent.runtime.state import initial_state
from agent.services.correlation.engine import AlarmCorrelationEngine

ROOT = Path(__file__).resolve().parents[2]
ALARMS_PATH = ROOT / "data" / "alarms" / "alarms.json"
GROUND_TRUTH_PATH = ROOT / "data" / "ground_truth" / "expected_incidents.json"


def _scenario_bundle(scenario_id: str) -> tuple[dict, list[dict]]:
    alarms = [
        row
        for row in json.loads(ALARMS_PATH.read_text(encoding="utf-8"))["alarms"]
        if row.get("scenario_id") == scenario_id
    ]
    engine = AlarmCorrelationEngine()
    result = engine.correlate(alarms)
    assert result.incidents
    incident = result.incidents[0].model_dump(mode="json")
    return incident, alarms


def test_supervisor_routing_order() -> None:
    state = initial_state({"incident_id": "INC-X", "site_id": "SITE-003"})
    assert decide_next_action(state) == "alarm_correlation"
    state["node_status"]["alarm_correlation"] = "completed"
    assert decide_next_action(state) == "network_diagnostics"
    state["node_status"]["network_diagnostics"] = "completed"
    state["diagnostics_complete"] = True
    assert decide_next_action(state) == "root_cause_analysis"
    state["node_status"]["root_cause_analysis"] = "completed"
    state["rca_complete"] = True
    assert decide_next_action(state) == "incident_reporting"
    state["node_status"]["incident_reporting"] = "completed"
    state["report_complete"] = True
    assert decide_next_action(state) == "completed"


def test_outage_investigation_completes() -> None:
    incident, alarms = _scenario_bundle("SCN-OUTAGE-01")
    final = run_investigation(incident, alarms=alarms)
    assert final["workflow_status"] == "completed"
    assert final["diagnostics_complete"] is True
    assert final["rca_complete"] is True
    assert final["report_complete"] is True
    assert final["report"] is not None
    assert final["report"]["scenario_id"] == "SCN-OUTAGE-01"
    assert "backhaul" in (final["report"]["candidate_cause"] or "").lower() or "Backhaul" in (
        final["report"]["candidate_cause"] or ""
    )
    assert final["runbook_passages"]
    assert final["node_status"]["alarm_correlation"] == "completed"
    assert final["node_status"]["network_diagnostics"] == "completed"
    assert final["node_status"]["root_cause_analysis"] == "completed"
    assert final["node_status"]["incident_reporting"] == "completed"


def test_congestion_investigation_completes() -> None:
    incident, alarms = _scenario_bundle("SCN-CONGESTION-01")
    final = run_investigation(incident, alarms=alarms)
    assert final["workflow_status"] == "completed"
    assert final["report"]["incident_id"] == "INC-CONGESTION-001"
    assert final["site_context"].get("site_id") == "SITE-007"
    assert any("utilization" in s.lower() or "congestion" in s.lower() for s in (final["report"]["supporting_signals"] or []) + [final["report"]["candidate_cause"] or ""])


def test_deployment_investigation_completes() -> None:
    incident, alarms = _scenario_bundle("SCN-DEPLOY-01")
    final = run_investigation(incident, alarms=alarms)
    assert final["workflow_status"] == "completed"
    assert final["report"]["incident_id"] == "INC-DEPLOY-001"
    assert final["deployments"]
    assert any(
        "deployment" in (final["report"]["candidate_cause"] or "").lower()
        or "configuration" in (final["report"]["candidate_cause"] or "").lower()
        for _ in [0]
    )


def test_outage_report_has_ranked_causes_and_evidence() -> None:
    incident, alarms = _scenario_bundle("SCN-OUTAGE-01")
    final = run_investigation(incident, alarms=alarms)
    bundle = final["evidence_bundle"]
    assert bundle["observed_facts"]
    assert bundle["inferences"]
    assert all(item["provenance"] == "observed" for item in bundle["observed_facts"])
    report = final["report"]
    assert len(report["candidates"]) == 2
    assert report["candidates"][0]["rank"] == 1
    assert report["candidates"][1]["contradictory"]
    assert report["timeline"]
    assert report["next_steps"]
    assert "not proof" in report["causation_note"]
    assert report["llm_used"] is False
    assert report["storage_uri"]
    assert report["action_status"] == "not_executed"


def test_reporting_blocked_without_rca() -> None:
    state = initial_state({"incident_id": "INC-X", "site_id": "SITE-003"})
    state["node_status"]["alarm_correlation"] = "completed"
    state["node_status"]["network_diagnostics"] = "completed"
    state["diagnostics_complete"] = True
    # RCA not complete
    assert decide_next_action(state) == "root_cause_analysis"

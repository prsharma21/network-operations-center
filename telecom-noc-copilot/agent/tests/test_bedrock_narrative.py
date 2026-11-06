from __future__ import annotations

from agent.services.rca import build_root_cause
from agent.services.reporting import build_report


def _narrator(_context: dict) -> dict[str, str]:
    return {
        "narrative": "Evidence points to transport isolation. This is not a verified cause.",
        "summary": "SITE-003 shows a backhaul hypothesis grounded in the supplied alarms.",
    }


def test_model_narrative_is_attached_without_replacing_the_rule_cause() -> None:
    rca = build_root_cause(
        incident={
            "incident_id": "INC-OUTAGE-001",
            "site_id": "SITE-003",
            "component": "backhaul",
            "scenario_id": "SCN-OUTAGE-01",
            "expected_cause": "Simulated backhaul link failure",
            "alarm_codes": ["SITE_UNREACHABLE", "BACKHAUL_LINK_DOWN"],
            "title": "SITE-003 correlated backhaul isolation",
        },
        alarms=[{"alarm_id": "ALM-0001", "alarm_code": "SITE_UNREACHABLE", "message": "down", "timestamp": "2026-10-19T01:13:00+00:00"}],
        telemetry=[],
        deployments=[],
        passages=[{"document_id": "RB-1", "title": "Backhaul checks", "source_ref": "runbook"}],
        narrator=_narrator,
    )
    assert rca["llm_used"] is True
    assert rca["method"] == "rules_with_bedrock_narrative"
    assert "backhaul" in rca["candidate_cause"].lower()
    assert rca["narrative"].startswith("Evidence points")
    report = build_report(
        {
            "incident": {"incident_id": "INC-OUTAGE-001", "site_id": "SITE-003", "title": "Outage"},
            "rca": rca,
            "site_context": {},
            "alarms": [],
            "telemetry": [],
            "deployments": [],
            "topology": {},
            "runbook_passages": [],
            "evidence_bundle": {"observed_facts": []},
            "findings": [],
        }
    )
    assert report["llm_used"] is True
    assert report["summary"].startswith("SITE-003 shows a backhaul")
    assert "not proof" in report["summary"]

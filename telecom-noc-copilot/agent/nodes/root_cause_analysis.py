"""Root Cause Analysis specialist node.

Day 19 ranks candidate causes from correlated alarms, KPI samples, deployment
history, and runbook passages. When BEDROCK_MODEL_ID is set, Bedrock writes
the narrative. The ranked evidence stays on the rules. A missing model keeps
the rule-based wording.
"""

from __future__ import annotations

from typing import Any

from agent.nodes._helpers import append_error, append_finding, mark_status
from agent.runtime.state import InvestigationState
from agent.services.rca import build_root_cause
from agent.services.runbook_retrieval import retrieve_runbook_passages


def root_cause_analysis_node(state: InvestigationState) -> dict[str, Any]:
    updates: dict[str, Any] = mark_status(state, "root_cause_analysis", "running")
    updates["workflow_status"] = "analyzing"
    if not state.get("diagnostics_complete"):
        failure = append_error(
            state,
            "root_cause_analysis",
            "Diagnostics incomplete; refusing RCA.",
        )
        failure.update(mark_status(state, "root_cause_analysis", "failed"))
        failure["next_action"] = "network_diagnostics"
        return failure

    try:
        incident = dict(state.get("incident") or {})
        passages = retrieve_runbook_passages(
            alarm_codes=list(incident.get("alarm_codes") or []),
            scenario_id=incident.get("scenario_id"),
            incident_id=incident.get("incident_id"),
            limit=3,
        )
        rca = build_root_cause(
            incident=incident,
            alarms=list(state.get("alarms") or []),
            telemetry=list(state.get("telemetry") or []),
            deployments=list(state.get("deployments") or []),
            passages=passages,
            evidence_bundle=dict(state.get("evidence_bundle") or {}),
        )
        updates["runbook_passages"] = passages
        updates["rca"] = rca
        updates["rca_complete"] = True
        updates["findings"] = append_finding(
            state,
            {
                "node": "root_cause_analysis",
                "summary": f"RCA candidate: {rca['candidate_cause']}",
                "evidence_refs": list(rca["runbook_refs"]),
                "details": rca,
            },
        )
        updates.update(mark_status({**state, **updates}, "root_cause_analysis", "completed"))  # type: ignore[arg-type]
        updates["next_action"] = "incident_reporting"
        return updates
    except Exception as exc:  # noqa: BLE001
        failure = append_error(state, "root_cause_analysis", str(exc))
        failure.update(mark_status(state, "root_cause_analysis", "failed"))
        failure["next_action"] = "supervisor"
        return failure

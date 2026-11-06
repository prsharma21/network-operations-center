"""Incident Reporting specialist node.

Day 20 writes the investigation report only after diagnostics and root-cause
analysis are complete, then stores that report for later retrieval.
"""

from __future__ import annotations

from typing import Any

from agent.nodes._helpers import append_error, append_finding, mark_status
from agent.runtime.state import InvestigationState
from agent.services.report_store import get_report_store
from agent.services.reporting import build_report


def incident_reporting_node(state: InvestigationState) -> dict[str, Any]:
    updates: dict[str, Any] = mark_status(state, "incident_reporting", "running")
    updates["workflow_status"] = "reporting"

    if not state.get("diagnostics_complete") or not state.get("rca_complete"):
        failure = append_error(
            state,
            "incident_reporting",
            "Required diagnostics/RCA outputs are missing.",
        )
        failure.update(mark_status(state, "incident_reporting", "failed"))
        failure["next_action"] = "supervisor"
        return failure

    try:
        report = build_report({**state, **updates})
        report = get_report_store().save(report)
        updates["report"] = report
        updates["report_complete"] = True
        updates["workflow_status"] = "completed"
        updates["findings"] = append_finding(
            state,
            {
                "node": "incident_reporting",
                "summary": f"Report {report['report_id']} generated.",
                "evidence_refs": [report["report_id"]],
            },
        )
        updates.update(mark_status({**state, **updates}, "incident_reporting", "completed"))  # type: ignore[arg-type]
        updates["next_action"] = "completed"
        return updates
    except Exception as exc:  # noqa: BLE001
        failure = append_error(state, "incident_reporting", str(exc))
        failure.update(mark_status(state, "incident_reporting", "failed"))
        failure["next_action"] = "supervisor"
        return failure

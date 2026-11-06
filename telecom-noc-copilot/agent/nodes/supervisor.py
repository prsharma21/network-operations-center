"""Supervisor Agent — central orchestrator for the investigation workflow."""

from __future__ import annotations

from typing import Any, Literal

from agent.nodes._helpers import mark_status
from agent.runtime.state import InvestigationState

NextHop = Literal[
    "alarm_correlation",
    "network_diagnostics",
    "root_cause_analysis",
    "incident_reporting",
    "completed",
    "failed",
]


def decide_next_action(state: InvestigationState) -> NextHop:
    """Deterministic routing policy with retries and completion gates."""
    node_status = state.get("node_status") or {}
    retries = state.get("retries") or {}
    max_retries = int(state.get("max_retries") or 2)

    def failed_exhausted(node: str) -> bool:
        return node_status.get(node) == "failed" and int(retries.get(node, 0)) > max_retries

    if state.get("report_complete") or node_status.get("incident_reporting") == "completed":
        return "completed"

    if failed_exhausted("alarm_correlation") or failed_exhausted("network_diagnostics"):
        return "failed"
    if failed_exhausted("root_cause_analysis") or failed_exhausted("incident_reporting"):
        return "failed"

    if node_status.get("alarm_correlation") != "completed":
        return "alarm_correlation"
    if node_status.get("network_diagnostics") != "completed" or not state.get("diagnostics_complete"):
        return "network_diagnostics"
    if node_status.get("root_cause_analysis") != "completed" or not state.get("rca_complete"):
        # RCA may bounce diagnostics if incomplete.
        if not state.get("diagnostics_complete"):
            return "network_diagnostics"
        return "root_cause_analysis"
    if node_status.get("incident_reporting") != "completed" or not state.get("report_complete"):
        if not (state.get("diagnostics_complete") and state.get("rca_complete")):
            return "root_cause_analysis" if state.get("diagnostics_complete") else "network_diagnostics"
        return "incident_reporting"
    return "completed"


def supervisor_node(state: InvestigationState) -> dict[str, Any]:
    updates = mark_status(state, "supervisor", "running")
    nxt = decide_next_action(state)
    updates["next_action"] = nxt
    if nxt == "completed":
        updates["workflow_status"] = "completed"
    elif nxt == "failed":
        updates["workflow_status"] = "failed"
    else:
        updates["workflow_status"] = {
            "alarm_correlation": "correlating",
            "network_diagnostics": "diagnosing",
            "root_cause_analysis": "analyzing",
            "incident_reporting": "reporting",
        }.get(nxt, state.get("workflow_status") or "pending")
    updates.update(mark_status({**state, **updates}, "supervisor", "completed"))  # type: ignore[arg-type]
    return updates

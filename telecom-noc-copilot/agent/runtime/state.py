"""Shared investigation state for the LangGraph supervisor workflow."""

from __future__ import annotations

from typing import Any, Literal, NotRequired, TypedDict

WorkflowStatus = Literal[
    "pending",
    "correlating",
    "diagnosing",
    "analyzing",
    "reporting",
    "completed",
    "failed",
]


class InvestigationState(TypedDict):
    """Shared state passed between supervisor and specialist nodes."""

    incident: dict[str, Any]
    alarms: list[dict[str, Any]]
    site_context: dict[str, Any]
    telemetry: list[dict[str, Any]]
    deployments: list[dict[str, Any]]
    topology: dict[str, Any]
    runbook_passages: list[dict[str, Any]]
    findings: list[dict[str, Any]]
    report: dict[str, Any] | None
    errors: list[dict[str, Any]]
    node_status: dict[str, str]
    retries: dict[str, int]
    workflow_status: WorkflowStatus
    next_action: str
    max_retries: int
    correlation_result: NotRequired[dict[str, Any]]
    diagnostics_complete: bool
    rca_complete: bool
    report_complete: bool
    evidence_bundle: dict[str, Any]
    rca: dict[str, Any] | None


def initial_state(
    incident: dict[str, Any],
    *,
    alarms: list[dict[str, Any]] | None = None,
    max_retries: int = 2,
) -> InvestigationState:
    return InvestigationState(
        incident=dict(incident),
        alarms=list(alarms or incident.get("evidence_alarms") or []),
        site_context={},
        telemetry=[],
        deployments=[],
        topology={},
        runbook_passages=[],
        findings=[],
        report=None,
        errors=[],
        node_status={
            "supervisor": "pending",
            "alarm_correlation": "pending",
            "network_diagnostics": "pending",
            "root_cause_analysis": "pending",
            "incident_reporting": "pending",
        },
        retries={
            "alarm_correlation": 0,
            "network_diagnostics": 0,
            "root_cause_analysis": 0,
            "incident_reporting": 0,
        },
        workflow_status="pending",
        next_action="alarm_correlation",
        max_retries=max_retries,
        diagnostics_complete=False,
        rca_complete=False,
        report_complete=False,
        evidence_bundle={},
        rca=None,
    )

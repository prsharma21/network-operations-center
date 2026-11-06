"""Shared helpers for specialist nodes."""

from __future__ import annotations

from typing import Any

from agent.runtime.state import InvestigationState


def mark_status(state: InvestigationState, node: str, status: str) -> dict[str, Any]:
    node_status = dict(state.get("node_status") or {})
    node_status[node] = status
    return {"node_status": node_status}


def append_error(state: InvestigationState, node: str, message: str) -> dict[str, Any]:
    errors = list(state.get("errors") or [])
    errors.append({"node": node, "message": message})
    retries = dict(state.get("retries") or {})
    retries[node] = int(retries.get(node, 0)) + 1
    return {"errors": errors, "retries": retries}


def append_finding(state: InvestigationState, finding: dict[str, Any]) -> list[dict[str, Any]]:
    findings = list(state.get("findings") or [])
    findings.append(finding)
    return findings

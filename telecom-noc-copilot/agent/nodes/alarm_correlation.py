"""Alarm Correlation specialist node.

Re-validates / enriches the Day 16 correlated incident already in state.
Does not call an LLM.
"""

from __future__ import annotations

from typing import Any

from agent.nodes._helpers import append_error, append_finding, mark_status
from agent.runtime.state import InvestigationState
from agent.services.correlation.engine import AlarmCorrelationEngine
from agent.services.correlation.models import AlarmEvent


def alarm_correlation_node(state: InvestigationState) -> dict[str, Any]:
    updates: dict[str, Any] = mark_status(state, "alarm_correlation", "running")
    updates["workflow_status"] = "correlating"
    try:
        incident = dict(state.get("incident") or {})
        alarms_raw = list(state.get("alarms") or [])
        if not alarms_raw and incident.get("evidence_alarm_ids"):
            # Minimal placeholders when only IDs were supplied.
            alarms_raw = [
                {
                    "alarm_id": alarm_id,
                    "site_id": incident.get("site_id"),
                    "alarm_code": "UNKNOWN",
                    "severity": incident.get("severity") or "major",
                    "status": "active",
                    "timestamp": incident.get("window_start") or "2026-10-19T00:00:00+00:00",
                    "message": "Evidence alarm",
                    "region": incident.get("region"),
                    "scenario_id": incident.get("scenario_id"),
                    "correlation_key": incident.get("correlation_key"),
                }
                for alarm_id in incident.get("evidence_alarm_ids") or []
            ]

        engine = AlarmCorrelationEngine()
        # Prefer re-correlation when full alarm rows are present.
        usable = []
        for row in alarms_raw:
            try:
                usable.append(AlarmEvent.model_validate(row))
            except Exception:
                continue

        if len(usable) >= 2:
            result = engine.correlate(usable)
            matched = None
            for item in result.incidents:
                if item.site_id == incident.get("site_id") and not item.is_duplicate:
                    matched = item
                    break
                if item.incident_id == incident.get("incident_id"):
                    matched = item
                    break
            if matched is not None:
                incident = matched.model_dump(mode="json")
                updates["correlation_result"] = result.model_dump(mode="json")
                updates["alarms"] = [item.model_dump(mode="json") for item in usable]

        updates["incident"] = incident
        updates["findings"] = append_finding(
            state,
            {
                "node": "alarm_correlation",
                "summary": (
                    f"Correlated {len(incident.get('evidence_alarm_ids') or [])} alarms "
                    f"for {incident.get('site_id')} "
                    f"(scenario={incident.get('scenario_id')}, component={incident.get('component')})."
                ),
                "evidence_refs": list(incident.get("evidence_alarm_ids") or []),
            },
        )
        updates.update(mark_status({**state, **updates}, "alarm_correlation", "completed"))  # type: ignore[arg-type]
        updates["next_action"] = "network_diagnostics"
        return updates
    except Exception as exc:  # noqa: BLE001 - bounded node failure path
        failure = append_error(state, "alarm_correlation", str(exc))
        failure.update(mark_status(state, "alarm_correlation", "failed"))
        failure["next_action"] = "supervisor"
        failure["workflow_status"] = "failed"
        return failure

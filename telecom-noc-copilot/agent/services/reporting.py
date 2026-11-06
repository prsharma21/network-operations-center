"""Day 20 structured investigation report."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from agent.services.rca import CAUSATION_NOTE


def build_report(state: dict[str, Any]) -> dict[str, Any]:
    incident = dict(state.get("incident") or {})
    rca = dict(state.get("rca") or _rca_from_findings(state))
    site = dict(state.get("site_context") or {})
    site_id = str(incident.get("site_id") or site.get("site_id") or "")
    site_name = site.get("site_name") or incident.get("site_name") or site_id
    passages = list(state.get("runbook_passages") or [])
    alarms = list(state.get("alarms") or [])
    evidence = dict(state.get("evidence_bundle") or {})
    generated_at = datetime.now(UTC).isoformat()
    cause = rca.get("candidate_cause")
    narrative = str(rca.get("summary") or rca.get("narrative") or "").strip()
    if narrative:
        summary = f"{narrative} {CAUSATION_NOTE}"
    else:
        summary = (
            f"{incident.get('title') or site_id} investigation collected "
            f"{len(evidence.get('observed_facts') or [])} observed facts. "
            f"Leading hypothesis: {cause}. {CAUSATION_NOTE}"
        )
    return {
        "report_id": f"RPT-{(incident.get('incident_id') or 'UNKNOWN')}",
        "incident_id": incident.get("incident_id"),
        "site_id": site_id,
        "title": incident.get("title"),
        "summary": summary,
        "severity": incident.get("severity"),
        "priority": incident.get("priority"),
        "status": incident.get("status") or "OPEN",
        "scenario_id": incident.get("scenario_id"),
        "created_at": incident.get("window_start") or incident.get("created_at") or generated_at,
        "generated_at": generated_at,
        "affected_sites": [{"site_id": site_id, "site_name": site_name}] if site_id else [],
        "timeline": _timeline(alarms, list(state.get("telemetry") or []), list(state.get("deployments") or []), generated_at),
        "candidate_cause": cause,
        "confidence": rca.get("confidence"),
        "candidates": list(rca.get("candidates") or []),
        "supporting_signals": rca.get("supporting_signals") or [],
        "causation_note": rca.get("causation_note") or CAUSATION_NOTE,
        "evidence": list(evidence.get("observed_facts") or []),
        "missing_evidence": list(evidence.get("missing") or []),
        "contradictions": list(evidence.get("contradictions") or []),
        "inferences": list(evidence.get("inferences") or []),
        "evidence_alarm_ids": incident.get("evidence_alarm_ids") or [],
        "runbook_passages": passages,
        "runbook_sources": [item.get("source_ref") for item in passages if item.get("source_ref")],
        "next_steps": _next_steps(passages),
        "diagnostics": {
            "site_status": site.get("status"),
            "telemetry_samples": len(state.get("telemetry") or []),
            "deployments": len(state.get("deployments") or []),
            "topology_links": len((state.get("topology") or {}).get("links") or []),
        },
        "findings": state.get("findings") or [],
        "llm_used": bool(rca.get("llm_used")),
        "synthetic": True,
        "action_status": "not_executed",
    }


def _rca_from_findings(state: dict[str, Any]) -> dict[str, Any]:
    matches = [item for item in (state.get("findings") or []) if item.get("node") == "root_cause_analysis"]
    if not matches:
        return {}
    details = matches[-1].get("details")
    return dict(details) if isinstance(details, dict) else {}


def _timeline(
    alarms: list[dict[str, Any]],
    telemetry: list[dict[str, Any]],
    deployments: list[dict[str, Any]],
    generated_at: str,
) -> list[dict[str, str]]:
    events: list[dict[str, str]] = []
    for row in alarms:
        alarm_id = str(row.get("alarm_id") or "")
        events.append(
            {
                "id": alarm_id or "alarm",
                "kind": "alarm",
                "timestamp": str(row.get("timestamp") or ""),
                "title": str(row.get("alarm_code") or row.get("alarm_type") or "Alarm"),
                "detail": str(row.get("message") or ""),
                "source_event_id": alarm_id,
            }
        )
    for sample in telemetry:
        if str(sample.get("state") or "").lower() != "abnormal":
            continue
        metric_id = str(sample.get("metric_id") or "")
        events.append(
            {
                "id": metric_id or "kpi",
                "kind": "kpi",
                "timestamp": str(sample.get("timestamp") or ""),
                "title": "Abnormal KPI sample",
                "detail": f"state={sample.get('state')}",
                "source_event_id": metric_id or "kpi",
            }
        )
    for deployment in deployments:
        deployment_id = str(deployment.get("deployment_id") or "")
        events.append(
            {
                "id": deployment_id or "deployment",
                "kind": "deployment",
                "timestamp": str(deployment.get("timestamp") or ""),
                "title": f"Deployment {deployment.get('status') or ''}".strip(),
                "detail": str(deployment.get("notes") or ""),
                "source_event_id": deployment_id,
            }
        )
    events.append(
        {
            "id": "investigation",
            "kind": "investigation",
            "timestamp": generated_at,
            "title": "Investigation report generated",
            "detail": "Ranked hypotheses are ready for engineer review. No network change was executed.",
            "source_event_id": "investigation",
        }
    )
    events.sort(key=lambda item: item.get("timestamp") or "")
    return events


def _next_steps(passages: list[dict[str, Any]]) -> list[str]:
    steps: list[str] = []
    for passage in passages:
        for step in passage.get("steps") or []:
            text = str(step).strip()
            if text and text not in steps:
                steps.append(text)
        if len(steps) >= 5:
            break
    if not steps:
        steps.append("Review the observed facts with a NOC engineer before any action.")
    steps.append("This report recommends checks only. It does not execute a network change.")
    return steps[:6]

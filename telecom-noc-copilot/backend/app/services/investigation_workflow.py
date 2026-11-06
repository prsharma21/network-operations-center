"""Run the Day 16–20 investigation workflow for one incident.

The agent graph stays rule-based. This module loads fixture or database
records, runs that graph, and shapes the result for the NOC UI. When a
database session is present and the incident row exists, the summary is also
stored in ``investigation_results``.
"""

from __future__ import annotations

import json
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from oss_api.exceptions import IncidentNotFound

_STATUS = {
    "OPEN": "open",
    "INVESTIGATING": "in-progress",
    "AWAITING_APPROVAL": "pending",
    "CLOSED": "resolved",
    "RESOLVED": "resolved",
}
_ALARM_STATUS = {
    "active": "open",
    "acknowledged": "in-progress",
    "cleared": "resolved",
}


def investigate_incident(
    incident_id: str,
    repository: Any,
    db: Any | None = None,
) -> dict[str, Any]:
    record = repository.get_incident_record(incident_id.strip())
    if record is None:
        raise IncidentNotFound(incident_id)
    alarms = _alarms_for(repository, record)
    final = _run(dict(record), alarms)
    if final.get("workflow_status") != "completed" or not final.get("report"):
        message = _failure_message(final)
        raise InvestigationFailed(message)
    report = dict(final["report"])
    report["persistence"] = _persist_postgres(db, report)
    return investigation_view(record, final, report)


def load_report(incident_id: str) -> dict[str, Any] | None:
    _ensure_agent_path()
    from agent.services.report_store import get_report_store

    stored = get_report_store().get(incident_id.strip())
    if stored is None:
        return None
    return report_view(stored)


def investigation_view(
    record: dict[str, Any],
    final: dict[str, Any],
    report: dict[str, Any],
) -> dict[str, Any]:
    incident = dict(final.get("incident") or record)
    site_id = str(report.get("site_id") or record.get("site_id") or "")
    site_name = str(
        (final.get("site_context") or {}).get("site_name")
        or record.get("site_name")
        or site_id
    )
    alarms = [_alarm(row) for row in (final.get("alarms") or [])]
    passages = [_passage(item) for item in (report.get("runbook_passages") or [])]
    return {
        "incidentId": record.get("incident_id") or incident.get("incident_id"),
        "title": report.get("title") or record.get("title") or record.get("incident_id"),
        "severity": report.get("severity") or record.get("severity") or "info",
        "priority": report.get("priority") or record.get("priority") or "P3",
        "status": _STATUS.get(str(record.get("status") or "").upper(), "open"),
        "affectedSites": [{"siteId": site_id, "siteName": site_name}] if site_id else [],
        "createdAt": record.get("created_at") or report.get("created_at"),
        "investigationStatus": "completed",
        "correlatedAlarms": alarms,
        "timeline": [_timeline_event(item) for item in (report.get("timeline") or [])],
        "evidence": [
            _evidence(item)
            for item in (report.get("evidence") or [])
            if item.get("category") in {"metric", "inventory", "topology", "deployment"}
        ],
        "candidates": [_candidate(item) for item in (report.get("candidates") or [])],
        "runbookPassages": passages,
        "runbookRetrieval": "retrieved" if passages else "empty",
        "recommendation": None,
        "reportId": report.get("report_id"),
        "reportHref": "/reports",
        "investigationError": None,
        "source": "api",
        "missingEndpoints": [],
        "asOf": report.get("generated_at") or datetime.now(UTC).isoformat(),
        "summary": report.get("summary"),
        "nextSteps": report.get("next_steps") or [],
        "causationNote": report.get("causation_note"),
    }


def report_view(report: dict[str, Any]) -> dict[str, Any]:
    passages = [_passage(item) for item in (report.get("runbook_passages") or [])]
    sites = [
        {"siteId": item.get("site_id"), "siteName": item.get("site_name") or item.get("site_id")}
        for item in (report.get("affected_sites") or [])
    ]
    return {
        "reportId": report.get("report_id"),
        "incidentId": report.get("incident_id"),
        "title": report.get("title") or report.get("incident_id"),
        "summary": report.get("summary") or "",
        "severity": report.get("severity") or "info",
        "priority": report.get("priority") or "P3",
        "status": _STATUS.get(str(report.get("status") or "").upper(), "open"),
        "affectedSites": sites,
        "createdAt": report.get("created_at"),
        "generatedAt": report.get("generated_at"),
        "investigationStatus": "completed",
        "timeline": [_timeline_event(item) for item in (report.get("timeline") or [])],
        "correlatedAlarms": [],
        "kpiAnomalies": [
            _timeline_event(item)
            for item in (report.get("timeline") or [])
            if item.get("kind") == "kpi"
        ],
        "candidates": [_candidate(item) for item in (report.get("candidates") or [])],
        "runbookPassages": passages,
        "runbookRetrieval": "retrieved" if passages else "empty",
        "recommendation": None,
        "actionStatus": "not_executed",
        "audit": [],
        "nextSteps": report.get("next_steps") or [],
        "source": "api",
        "missingEndpoints": [],
        "asOf": report.get("generated_at"),
    }


class InvestigationFailed(RuntimeError):
    """The supervisor workflow finished without a report."""


def _alarms_for(repository: Any, record: dict[str, Any]) -> list[dict[str, Any]]:
    wanted = {str(item) for item in (record.get("evidence_alarm_ids") or [])}
    rows = repository.list_alarm_records()
    if not wanted:
        site_id = record.get("site_id")
        return [row for row in rows if row.get("site_id") == site_id]
    return [row for row in rows if str(row.get("alarm_id")) in wanted]


def _run(incident: dict[str, Any], alarms: list[dict[str, Any]]) -> dict[str, Any]:
    _ensure_agent_path()
    from agent.runtime.graph import run_investigation

    return run_investigation(incident, alarms=alarms)


def _ensure_agent_path() -> None:
    root = Path(__file__).resolve().parents[3]
    text = str(root)
    if text not in sys.path:
        sys.path.insert(0, text)


def _failure_message(final: dict[str, Any]) -> str:
    errors = final.get("errors") or []
    if errors:
        last = errors[-1]
        return str(last.get("message") or last)
    return "Investigation did not produce a report."


def _persist_postgres(db: Any | None, report: dict[str, Any]) -> str:
    if db is None:
        return "local_file"
    try:
        from sqlalchemy import select

        from app.db.models import IncidentRow, InvestigationResultRow
    except ImportError:
        return "local_file"
    incident_id = str(report.get("incident_id") or "")
    incident = db.scalar(select(IncidentRow).where(IncidentRow.incident_id == incident_id))
    if incident is None:
        return "local_file"
    top = (report.get("candidates") or [{}])[0]
    score = float(top.get("confidence_pct") or 0) / 100.0
    stamp = datetime.now(UTC).strftime("%Y%m%d%H%M%S")
    row = InvestigationResultRow(
        investigation_id=f"INV-{incident_id}-{stamp}"[:64],
        incident_id=incident.id,
        summary=str(report.get("summary") or "")[:4000],
        findings=json.dumps(
            {
                "candidates": report.get("candidates") or [],
                "causation_note": report.get("causation_note"),
            }
        ),
        confidence=score,
        method="deterministic_rules_and_runbooks",
    )
    try:
        db.add(row)
        db.commit()
    except Exception:
        db.rollback()
        return "local_file"
    return "postgresql"


def _alarm(row: dict[str, Any]) -> dict[str, Any]:
    status = str(row.get("status") or "active").lower()
    return {
        "alarmId": row.get("alarm_id"),
        "severity": row.get("severity") or "info",
        "timestamp": row.get("timestamp") or "",
        "siteId": row.get("site_id") or "",
        "alarmType": row.get("alarm_code") or row.get("alarm_type") or "",
        "message": row.get("message") or "",
        "status": _ALARM_STATUS.get(status, "open"),
    }


def _timeline_event(item: dict[str, Any]) -> dict[str, str]:
    return {
        "id": str(item.get("id") or ""),
        "kind": str(item.get("kind") or "investigation"),
        "timestamp": str(item.get("timestamp") or ""),
        "title": str(item.get("title") or ""),
        "detail": str(item.get("detail") or ""),
        "sourceEventId": str(item.get("source_event_id") or item.get("sourceEventId") or ""),
    }


def _evidence(item: dict[str, Any]) -> dict[str, str]:
    category = str(item.get("category") or "metric")
    if category not in {"metric", "inventory", "topology", "deployment"}:
        category = "metric"
    return {
        "id": str(item.get("id") or item.get("source_event_id") or ""),
        "category": category,
        "title": str(item.get("title") or ""),
        "detail": str(item.get("detail") or ""),
        "timestamp": str(item.get("timestamp") or ""),
        "sourceEventId": str(item.get("source_event_id") or ""),
    }


def _candidate(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "rank": item.get("rank") or 0,
        "title": item.get("title") or "",
        "hypothesis": item.get("hypothesis") or "",
        "confidencePct": item.get("confidence_pct") or item.get("confidencePct") or 0,
        "uncertainty": item.get("uncertainty") or "medium",
        "supporting": [_evidence_ref(ref) for ref in (item.get("supporting") or [])],
        "contradictory": [_evidence_ref(ref) for ref in (item.get("contradictory") or [])],
    }


def _evidence_ref(item: dict[str, Any]) -> dict[str, str]:
    return {
        "sourceEventId": str(item.get("source_event_id") or item.get("sourceEventId") or ""),
        "source": str(item.get("source") or ""),
        "timestamp": str(item.get("timestamp") or ""),
        "summary": str(item.get("summary") or ""),
    }


def _passage(item: dict[str, Any]) -> dict[str, Any]:
    document_id = str(item.get("document_id") or item.get("documentId") or "")
    related = item.get("related_incident_ids") or item.get("relatedIncidents") or []
    if related and isinstance(related[0], str):
        related_incidents = [{"incidentId": value} for value in related]
    else:
        related_incidents = list(related)
    postmortems = item.get("related_postmortems") or item.get("relatedPostmortems") or []
    return {
        "id": document_id,
        "documentId": document_id,
        "title": item.get("title") or document_id,
        "sourceRef": item.get("source_ref") or item.get("sourceRef") or "",
        "excerpt": item.get("body") or item.get("excerpt") or "",
        "technology": list(item.get("technology") or []),
        "alarmTypes": list(item.get("alarm_types") or item.get("alarmTypes") or []),
        "steps": list(item.get("steps") or []),
        "kpis": list(item.get("kpis") or []),
        "relatedIncidents": related_incidents,
        "relatedPostmortems": list(postmortems),
        "metadata": {"synthetic": "true"},
        "score": item.get("score") or 0,
    }

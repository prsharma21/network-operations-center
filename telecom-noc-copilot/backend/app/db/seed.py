"""Repeatable synthetic seed from ``telecom-noc-copilot/data`` JSON fixtures.

Rows are upserted on public business keys so re-runs do not duplicate. All
foreign keys point at seeded parents. Remediation actions stay proposed/pending;
nothing here performs a live network change.

Usage (from backend/):
    python -m app.db.seed
    python -m app.db.seed --counts
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.db.ids import stable_uuid
from app.db.models import (
    AuditEventRow,
    DeploymentRow,
    IncidentAlarmRow,
    IncidentRow,
    InvestigationResultRow,
    NetworkAlarmRow,
    NetworkSiteRow,
    RemediationActionRow,
    RunbookReferenceRow,
    TelemetryMetricRow,
)
from app.db.session import get_session_factory, reset_engine
from app.services.alarm_fingerprint import fingerprint_from_record
from app.utils.settings import get_settings
from app.utils.timestamps import parse_utc_datetime

logger = logging.getLogger("telecom_noc_copilot.seed")

INCIDENT_SEED_META: dict[str, dict[str, str]] = {
    "INC-OUTAGE-001": {
        "severity": "critical",
        "status": "OPEN",
        "priority": "P1",
        "title": "SITE-003 synthetic backhaul isolation",
    },
    "INC-CONGESTION-001": {
        "severity": "major",
        "status": "INVESTIGATING",
        "priority": "P2",
        "title": "SITE-007 synthetic radio congestion",
    },
    "INC-DEPLOY-001": {
        "severity": "major",
        "status": "AWAITING_APPROVAL",
        "priority": "P2",
        "title": "SITE-012 synthetic post-deployment degradation",
    },
}

REMEDIATION_SEED: tuple[tuple[str, str, str, str], ...] = (
    (
        "INC-OUTAGE-001",
        "ACT-OUTAGE-001",
        "transport_check",
        "Proposed microwave/fiber path verification. No live network change.",
    ),
    (
        "INC-CONGESTION-001",
        "ACT-CONGESTION-001",
        "capacity_review",
        "Proposed radio capacity review pending human approval.",
    ),
    (
        "INC-DEPLOY-001",
        "ACT-DEPLOY-001",
        "config_rollback_review",
        "Proposed configuration rollback review. Execution requires recorded approval.",
    ),
)


def seed_database(
    session: Session,
    data_dir: Path,
    *,
    fail_after: str | None = None,
) -> dict[str, int]:
    """Insert or update synthetic rows. Rolls back the caller session on error."""
    sites = _load_collection(data_dir / "sites" / "sites.json", "sites")
    alarms = _load_collection(data_dir / "alarms" / "alarms.json", "alarms")
    metrics = _load_collection(data_dir / "telemetry" / "telemetry_metrics.json", "metrics")
    deployments = _load_collection(
        data_dir / "deployments" / "deployment_events.json", "deployment_events"
    )
    incidents = _load_collection(data_dir / "ground_truth" / "expected_incidents.json", "incidents")
    runbooks = _load_collection(data_dir / "runbooks" / "runbook_catalog.json", "documents")

    site_pk = {row["site_id"]: stable_uuid("site", row["site_id"]) for row in sites}
    alarm_pk = {row["alarm_id"]: stable_uuid("alarm", row["alarm_id"]) for row in alarms}
    incident_pk = {
        row["incident_id"]: stable_uuid("incident", row["incident_id"]) for row in incidents
    }

    _upsert_sites(session, sites, site_pk)
    _raise_if(fail_after, "sites")
    _upsert_alarms(session, alarms, site_pk, alarm_pk)
    _raise_if(fail_after, "alarms")
    _upsert_metrics(session, metrics, site_pk)
    _raise_if(fail_after, "metrics")
    _upsert_deployments(session, deployments, site_pk)
    _raise_if(fail_after, "deployments")
    _upsert_incidents(session, incidents, site_pk, alarm_pk, incident_pk, alarms)
    _raise_if(fail_after, "incidents")
    _upsert_investigations(session, incidents, incident_pk)
    _upsert_runbooks(session, runbooks, incident_pk)
    _upsert_remediations(session, incident_pk, alarms)
    _upsert_audit_events(session, incidents, incident_pk)
    session.flush()
    return count_rows(session)


def count_rows(session: Session) -> dict[str, int]:
    models = (
        NetworkSiteRow,
        NetworkAlarmRow,
        TelemetryMetricRow,
        DeploymentRow,
        IncidentRow,
        IncidentAlarmRow,
        InvestigationResultRow,
        RunbookReferenceRow,
        RemediationActionRow,
        AuditEventRow,
    )
    counts: dict[str, int] = {}
    for model in models:
        counts[model.__tablename__] = int(session.scalar(select(func.count()).select_from(model)) or 0)
    return counts


def _upsert_sites(session: Session, rows: list[dict[str, Any]], site_pk: dict[str, UUID]) -> None:
    created = _ts("2026-10-18T00:00:00+00:00")
    values = []
    for row in rows:
        site_id = str(row["site_id"])
        values.append(
            {
                "id": site_pk[site_id],
                "site_id": site_id,
                "site_code": site_id,
                "name": row["site_name"],
                "region": row["region"],
                "status": row["status"],
                "technology": row["technology"],
                "vendor": row["vendor"],
                "latitude": float(row["latitude"]),
                "longitude": float(row["longitude"]),
                "site_type": row.get("site_type"),
                "criticality": row.get("criticality"),
                "backhaul_type": row.get("backhaul_type"),
                "known_scenario": row.get("known_scenario"),
                "synthetic": bool(row.get("synthetic", True)),
                "created_at": created,
                "updated_at": created,
            }
        )
    _upsert(
        session,
        NetworkSiteRow,
        values,
        "site_id",
        update_cols=(
            "site_code",
            "name",
            "region",
            "status",
            "technology",
            "vendor",
            "latitude",
            "longitude",
            "site_type",
            "criticality",
            "backhaul_type",
            "known_scenario",
            "synthetic",
            "updated_at",
        ),
    )


def _upsert_alarms(
    session: Session,
    rows: list[dict[str, Any]],
    site_pk: dict[str, UUID],
    alarm_pk: dict[str, UUID],
) -> None:
    values = []
    fingerprints: set[str] = set()
    for row in rows:
        alarm_id = str(row["alarm_id"])
        occurred = _ts(str(row["timestamp"]))
        fingerprint = fingerprint_from_record(row)
        if fingerprint in fingerprints:
            fingerprint = f"{fingerprint}|{alarm_id}"
        if fingerprint:
            fingerprints.add(fingerprint)
        values.append(
            {
                "id": alarm_pk[alarm_id],
                "alarm_id": alarm_id,
                "source_event_id": alarm_id,
                "fingerprint": fingerprint,
                "site_id": site_pk[str(row["site_id"])],
                "alarm_code": row["alarm_code"],
                "severity": row["severity"],
                "status": row["status"],
                "message": row["message"],
                "occurred_at": occurred,
                "created_at": occurred,
                "region": row.get("region"),
                "source": row.get("source"),
                "scenario_id": row.get("scenario_id"),
                "correlation_key": row.get("correlation_key"),
                "synthetic": bool(row.get("synthetic", True)),
            }
        )
    _upsert(
        session,
        NetworkAlarmRow,
        values,
        "alarm_id",
        update_cols=(
            "source_event_id",
            "fingerprint",
            "site_id",
            "alarm_code",
            "severity",
            "status",
            "message",
            "occurred_at",
            "region",
            "source",
            "scenario_id",
            "correlation_key",
            "synthetic",
        ),
    )


def _upsert_metrics(
    session: Session,
    rows: list[dict[str, Any]],
    site_pk: dict[str, UUID],
) -> None:
    values = []
    for row in rows:
        metric_id = str(row["metric_id"])
        recorded = _ts(str(row["timestamp"]))
        values.append(
            {
                "id": stable_uuid("metric", metric_id),
                "metric_id": metric_id,
                "site_id": site_pk[str(row["site_id"])],
                "latency_ms": float(row["latency_ms"]),
                "throughput_mbps": float(row["throughput_mbps"]),
                "utilization_pct": float(row["utilization_pct"]),
                "dropped_call_rate_pct": float(row["dropped_call_rate_pct"]),
                "sample_window_minutes": int(row.get("sample_window_minutes") or 5),
                "state": row.get("state") or "normal",
                "recorded_at": recorded,
                "created_at": recorded,
                "synthetic": bool(row.get("synthetic", True)),
            }
        )
    _upsert(
        session,
        TelemetryMetricRow,
        values,
        "metric_id",
        update_cols=(
            "site_id",
            "latency_ms",
            "throughput_mbps",
            "utilization_pct",
            "dropped_call_rate_pct",
            "sample_window_minutes",
            "state",
            "recorded_at",
            "synthetic",
        ),
    )


def _upsert_deployments(
    session: Session,
    rows: list[dict[str, Any]],
    site_pk: dict[str, UUID],
) -> None:
    values = []
    for row in rows:
        deployment_id = str(row["deployment_id"])
        started = _ts(str(row["timestamp"]))
        status = str(row["status"])
        completed = started + timedelta(minutes=15) if status.startswith("completed") else None
        values.append(
            {
                "id": stable_uuid("deployment", deployment_id),
                "deployment_id": deployment_id,
                "site_id": site_pk[str(row["site_id"])],
                "change_type": row["change_type"],
                "version_before": row["version_before"],
                "version_after": row["version_after"],
                "status": status,
                "notes": row["notes"],
                "change_ticket": row.get("change_ticket"),
                "started_at": started,
                "completed_at": completed,
                "created_at": started,
                "synthetic": bool(row.get("synthetic", True)),
            }
        )
    _upsert(
        session,
        DeploymentRow,
        values,
        "deployment_id",
        update_cols=(
            "site_id",
            "change_type",
            "version_before",
            "version_after",
            "status",
            "notes",
            "change_ticket",
            "started_at",
            "completed_at",
            "synthetic",
        ),
    )


def _upsert_incidents(
    session: Session,
    rows: list[dict[str, Any]],
    site_pk: dict[str, UUID],
    alarm_pk: dict[str, UUID],
    incident_pk: dict[str, UUID],
    alarm_rows: list[dict[str, Any]],
) -> None:
    alarm_times = {str(item["alarm_id"]): _ts(str(item["timestamp"])) for item in alarm_rows}
    values = []
    links = []
    for row in rows:
        incident_id = str(row["incident_id"])
        meta = INCIDENT_SEED_META[incident_id]
        evidence = [str(item) for item in row.get("evidence_alarm_ids") or []]
        opened = min(alarm_times[alarm_id] for alarm_id in evidence)
        signals = row.get("expected_signals") or []
        description = (
            f"Synthetic evaluation label: {row['expected_cause']}. "
            f"Signals: {', '.join(signals)}. Not a verified root cause."
        )
        values.append(
            {
                "id": incident_pk[incident_id],
                "incident_id": incident_id,
                "site_id": site_pk[str(row["site_id"])],
                "title": meta["title"],
                "description": description,
                "severity": meta["severity"],
                "status": meta["status"],
                "priority": meta["priority"],
                "scenario_id": row.get("scenario_id"),
                "opened_at": opened,
                "resolved_at": None,
                "created_at": opened,
                "updated_at": opened,
                "synthetic": True,
            }
        )
        for alarm_id in evidence:
            links.append(
                {
                    "id": stable_uuid("incident_alarm", f"{incident_id}:{alarm_id}"),
                    "incident_id": incident_pk[incident_id],
                    "alarm_id": alarm_pk[alarm_id],
                    "created_at": opened,
                }
            )
    _upsert(
        session,
        IncidentRow,
        values,
        "incident_id",
        update_cols=(
            "site_id",
            "title",
            "description",
            "severity",
            "status",
            "priority",
            "scenario_id",
            "opened_at",
            "resolved_at",
            "updated_at",
            "synthetic",
        ),
    )
    _upsert(
        session,
        IncidentAlarmRow,
        links,
        None,
        constraint="uq_incident_alarms_pair",
        update_cols=(),
    )


def _upsert_investigations(
    session: Session,
    incidents: list[dict[str, Any]],
    incident_pk: dict[str, UUID],
) -> None:
    values = []
    for row in incidents:
        incident_id = str(row["incident_id"])
        investigation_id = f"INV-{incident_id}"
        values.append(
            {
                "id": stable_uuid("investigation", investigation_id),
                "investigation_id": investigation_id,
                "incident_id": incident_pk[incident_id],
                "summary": f"Synthetic investigation label for {incident_id}.",
                "findings": (
                    f"Expected cause label: {row['expected_cause']}. "
                    f"Evidence alarms: {', '.join(row['evidence_alarm_ids'])}. "
                    "Not verified RCA."
                ),
                "confidence": 0.72,
                "method": "synthetic_ground_truth",
                "created_at": _ts("2026-10-19T12:00:00+00:00"),
            }
        )
    _upsert(
        session,
        InvestigationResultRow,
        values,
        "investigation_id",
        update_cols=("incident_id", "summary", "findings", "confidence", "method"),
    )


def _upsert_runbooks(
    session: Session,
    documents: list[dict[str, Any]],
    incident_pk: dict[str, UUID],
) -> None:
    values = []
    created = _ts("2026-10-18T12:00:00+00:00")
    for doc in documents:
        document_id = str(doc["document_id"])
        related = [str(item) for item in doc.get("related_incident_ids") or []]
        if related:
            for incident_id in related:
                reference_id = f"{document_id}:{incident_id}"
                values.append(
                    {
                        "id": stable_uuid("runbook", reference_id),
                        "reference_id": reference_id,
                        "incident_id": incident_pk.get(incident_id),
                        "title": doc["title"],
                        "source_uri": doc.get("source_ref") or document_id,
                        "document_id": document_id,
                        "relevance_score": 0.86,
                        "created_at": created,
                    }
                )
        else:
            values.append(
                {
                    "id": stable_uuid("runbook", document_id),
                    "reference_id": document_id,
                    "incident_id": None,
                    "title": doc["title"],
                    "source_uri": doc.get("source_ref") or document_id,
                    "document_id": document_id,
                    "relevance_score": 0.5,
                    "created_at": created,
                }
            )
    _upsert(
        session,
        RunbookReferenceRow,
        values,
        "reference_id",
        update_cols=("incident_id", "title", "source_uri", "document_id", "relevance_score"),
    )


def _upsert_remediations(
    session: Session,
    incident_pk: dict[str, UUID],
    alarm_rows: list[dict[str, Any]],
) -> None:
    del alarm_rows
    proposed = _ts("2026-10-19T12:30:00+00:00")
    values = []
    for incident_id, action_id, action_type, description in REMEDIATION_SEED:
        values.append(
            {
                "id": stable_uuid("remediation", action_id),
                "action_id": action_id,
                "incident_id": incident_pk[incident_id],
                "action_type": action_type,
                "description": description,
                "status": "proposed",
                "proposed_at": proposed,
                "approved_at": None,
                "executed_at": None,
                "created_at": proposed,
            }
        )
    pending = {
        "id": stable_uuid("remediation", "ACT-OUTAGE-002"),
        "action_id": "ACT-OUTAGE-002",
        "incident_id": incident_pk["INC-OUTAGE-001"],
        "action_type": "field_dispatch_review",
        "description": "Pending field dispatch review. Not an executed network change.",
        "status": "pending",
        "proposed_at": proposed,
        "approved_at": None,
        "executed_at": None,
        "created_at": proposed,
    }
    values.append(pending)
    _upsert(
        session,
        RemediationActionRow,
        values,
        "action_id",
        update_cols=(
            "incident_id",
            "action_type",
            "description",
            "status",
            "proposed_at",
            "approved_at",
            "executed_at",
        ),
    )


def _upsert_audit_events(
    session: Session,
    incidents: list[dict[str, Any]],
    incident_pk: dict[str, UUID],
) -> None:
    created = _ts("2026-10-19T12:45:00+00:00")
    values = [
        {
            "id": stable_uuid("audit", "AUD-SEED-001"),
            "event_id": "AUD-SEED-001",
            "incident_id": None,
            "event_type": "database_seed",
            "actor": "seed-script",
            "details": {"synthetic": True, "source": "telecom-noc-copilot/data"},
            "created_at": created,
        }
    ]
    for row in incidents:
        incident_id = str(row["incident_id"])
        event_id = f"AUD-{incident_id}"
        values.append(
            {
                "id": stable_uuid("audit", event_id),
                "event_id": event_id,
                "incident_id": incident_pk[incident_id],
                "event_type": "incident_opened",
                "actor": "synthetic-oss",
                "details": {
                    "incident_id": incident_id,
                    "evidence_alarm_ids": row.get("evidence_alarm_ids"),
                    "synthetic": True,
                },
                "created_at": created,
            }
        )
    _upsert(
        session,
        AuditEventRow,
        values,
        "event_id",
        update_cols=("incident_id", "event_type", "actor", "details"),
    )


def _upsert(
    session: Session,
    model: type[Any],
    values: list[dict[str, Any]],
    index_element: str | None,
    *,
    update_cols: tuple[str, ...],
    constraint: str | None = None,
) -> None:
    if not values:
        return
    stmt = insert(model).values(values)
    if not update_cols:
        if constraint:
            stmt = stmt.on_conflict_do_nothing(constraint=constraint)
        else:
            stmt = stmt.on_conflict_do_nothing(index_elements=[index_element])
    elif constraint:
        stmt = stmt.on_conflict_do_update(
            constraint=constraint,
            set_={col: stmt.excluded[col] for col in update_cols},
        )
    else:
        stmt = stmt.on_conflict_do_update(
            index_elements=[index_element],
            set_={col: stmt.excluded[col] for col in update_cols},
        )
    session.execute(stmt)


def _load_collection(path: Path, key: str) -> list[dict[str, Any]]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    rows = payload.get(key, [])
    if not isinstance(rows, list):
        return []
    return [row for row in rows if isinstance(row, dict)]


def _ts(value: str) -> datetime:
    parsed = parse_utc_datetime(value)
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC)


def _raise_if(fail_after: str | None, step: str) -> None:
    if fail_after == step:
        raise RuntimeError(f"injected seed failure after {step}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Seed synthetic telecom NOC data")
    parser.add_argument("--counts", action="store_true", help="Print row counts after seeding")
    args = parser.parse_args(argv)

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    get_settings.cache_clear()
    reset_engine()
    factory = get_session_factory()
    if factory is None:
        print("DATABASE_URL is not set. Configure local PostgreSQL or RDS first.", file=sys.stderr)
        return 1
    session = factory()
    try:
        counts = seed_database(session, get_settings().data_dir)
        session.commit()
    except Exception:
        session.rollback()
        logger.exception("Seed failed; transaction rolled back")
        return 1
    finally:
        session.close()

    if args.counts:
        for table, count in counts.items():
            print(f"{table}={count}")
    else:
        print("Seed completed.")
        for table, count in counts.items():
            print(f"{table}={count}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

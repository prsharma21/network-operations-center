"""JSON-backed OSS repository.

Reads site, inventory, topology, alarm, telemetry, deployment, and ticket
JSON fixtures. Posted alarms and metrics are kept in memory only (the
dataset files are not rewritten). A PostgreSQL implementation can replace
this class later by satisfying the protocols.
"""

from __future__ import annotations

import json
import re
import threading
from collections.abc import Mapping
from pathlib import Path
from typing import Any, Protocol

from app.services.alarm_fingerprint import fingerprint_from_record
from oss_api.exceptions import DuplicateAlarm, DuplicateMetric

_ALARM_ID_PATTERN = re.compile(r"^ALM-(\d+)$", re.IGNORECASE)
_METRIC_ID_PATTERN = re.compile(r"^MET-(\d+)$", re.IGNORECASE)


class SiteRepository(Protocol):
    def get_site_record(self, site_id: str) -> dict[str, Any] | None: ...

    def list_equipment(self, site_id: str) -> list[dict[str, Any]]: ...

    def list_topology(self, site_id: str) -> list[dict[str, Any]]: ...


class OssDataRepository(SiteRepository, Protocol):
    def list_site_records(self) -> list[dict[str, Any]]: ...

    def list_alarm_records(self) -> list[dict[str, Any]]: ...

    def get_alarm_record(self, alarm_id: str) -> dict[str, Any] | None: ...

    def add_alarm_record(
        self,
        record: dict[str, Any],
        fingerprint: str | None = None,
    ) -> dict[str, Any]: ...

    def next_alarm_id(self) -> str: ...

    def list_metric_records(self) -> list[dict[str, Any]]: ...

    def get_metric_record(self, metric_id: str) -> dict[str, Any] | None: ...

    def add_metric_record(self, record: dict[str, Any]) -> dict[str, Any]: ...

    def next_metric_id(self) -> str: ...

    def list_deployment_records(self) -> list[dict[str, Any]]: ...

    def list_ticket_records(self) -> list[dict[str, Any]]: ...

    def list_incident_records(self) -> list[dict[str, Any]]: ...

    def get_incident_record(self, incident_id: str) -> dict[str, Any] | None: ...


class JsonOssRepository:
    def __init__(self, data_dir: Path) -> None:
        self._data_dir = data_dir
        self._lock = threading.Lock()
        self._sites_by_id: dict[str, dict[str, Any]] | None = None
        self._equipment_by_site: dict[str, list[dict[str, Any]]] | None = None
        self._topology_by_site: dict[str, list[dict[str, Any]]] | None = None
        self._alarms_by_id: dict[str, dict[str, Any]] | None = None
        self._metrics_by_id: dict[str, dict[str, Any]] | None = None
        self._deployments_by_id: dict[str, dict[str, Any]] | None = None
        self._tickets_by_id: dict[str, dict[str, Any]] | None = None
        self._incidents_by_id: dict[str, dict[str, Any]] | None = None
        self._alarm_fingerprints: dict[str, str] | None = None

    def get_site_record(self, site_id: str) -> dict[str, Any] | None:
        self._ensure_loaded()
        record = self._sites_by_id.get(site_id)
        return dict(record) if record is not None else None

    def list_site_records(self) -> list[dict[str, Any]]:
        self._ensure_loaded()
        return [dict(item) for item in self._sites_by_id.values()]

    def list_equipment(self, site_id: str) -> list[dict[str, Any]]:
        self._ensure_loaded()
        return [dict(item) for item in self._equipment_by_site.get(site_id, [])]

    def list_topology(self, site_id: str) -> list[dict[str, Any]]:
        self._ensure_loaded()
        return [dict(item) for item in self._topology_by_site.get(site_id, [])]

    def list_alarm_records(self) -> list[dict[str, Any]]:
        self._ensure_loaded()
        with self._lock:
            return [dict(item) for item in self._alarms_by_id.values()]

    def get_alarm_record(self, alarm_id: str) -> dict[str, Any] | None:
        self._ensure_loaded()
        with self._lock:
            record = self._alarms_by_id.get(alarm_id)
            return dict(record) if record is not None else None

    def add_alarm_record(
        self,
        record: dict[str, Any],
        fingerprint: str | None = None,
    ) -> dict[str, Any]:
        """Insert an alarm. ID generation, ID uniqueness, and fingerprint
        uniqueness run under one lock so concurrent POSTs cannot both insert.
        """
        self._ensure_loaded()
        with self._lock:
            alarm_id = str(record.get("alarm_id") or "").strip()
            if alarm_id and alarm_id in self._alarms_by_id:
                raise DuplicateAlarm(alarm_id)
            if fingerprint and fingerprint in self._alarm_fingerprints:
                raise DuplicateAlarm(self._alarm_fingerprints[fingerprint], reason="fingerprint")
            if not alarm_id:
                alarm_id = self._next_alarm_id_unlocked()
            stored = dict(record)
            stored["alarm_id"] = alarm_id
            self._alarms_by_id[alarm_id] = stored
            if fingerprint:
                self._alarm_fingerprints[fingerprint] = alarm_id
            return dict(stored)

    def next_alarm_id(self) -> str:
        self._ensure_loaded()
        with self._lock:
            return self._next_alarm_id_unlocked()

    def _next_alarm_id_unlocked(self) -> str:
        highest = 0
        for alarm_id in self._alarms_by_id:
            match = _ALARM_ID_PATTERN.match(alarm_id)
            if match:
                highest = max(highest, int(match.group(1)))
        return f"ALM-{highest + 1:04d}"

    def list_metric_records(self) -> list[dict[str, Any]]:
        self._ensure_loaded()
        with self._lock:
            return [dict(item) for item in self._metrics_by_id.values()]

    def get_metric_record(self, metric_id: str) -> dict[str, Any] | None:
        self._ensure_loaded()
        with self._lock:
            record = self._metrics_by_id.get(metric_id)
            return dict(record) if record is not None else None

    def add_metric_record(self, record: dict[str, Any]) -> dict[str, Any]:
        self._ensure_loaded()
        metric_id = str(record["metric_id"]).strip()
        with self._lock:
            if metric_id in self._metrics_by_id:
                raise DuplicateMetric(metric_id)
            stored = dict(record)
            stored["metric_id"] = metric_id
            self._metrics_by_id[metric_id] = stored
            return dict(stored)

    def next_metric_id(self) -> str:
        self._ensure_loaded()
        with self._lock:
            highest = 0
            for metric_id in self._metrics_by_id:
                match = _METRIC_ID_PATTERN.match(metric_id)
                if match:
                    highest = max(highest, int(match.group(1)))
            return f"MET-{highest + 1:05d}"

    def list_deployment_records(self) -> list[dict[str, Any]]:
        self._ensure_loaded()
        with self._lock:
            return [dict(item) for item in self._deployments_by_id.values()]

    def list_ticket_records(self) -> list[dict[str, Any]]:
        self._ensure_loaded()
        with self._lock:
            return [dict(item) for item in self._tickets_by_id.values()]

    def list_incident_records(self) -> list[dict[str, Any]]:
        self._ensure_loaded()
        return [dict(item) for item in self._incidents_by_id.values()]

    def get_incident_record(self, incident_id: str) -> dict[str, Any] | None:
        self._ensure_loaded()
        record = self._incidents_by_id.get(incident_id.strip())
        return dict(record) if record is not None else None

    def _ensure_loaded(self) -> None:
        if self._sites_by_id is not None:
            return
        sites_by_id = _index_by_id(
            _load_collection(self._data_dir / "sites" / "sites.json", "sites"),
            "site_id",
        )
        equipment_rows = _load_collection(
            self._data_dir / "oss" / "oss_inventory.json",
            "equipment",
        )
        topology_rows = _load_collection(
            self._data_dir / "topology" / "network_topology.json",
            "links",
        )
        alarm_rows = _load_collection(
            self._data_dir / "alarms" / "alarms.json",
            "alarms",
        )
        metric_rows = _load_collection(
            self._data_dir / "telemetry" / "telemetry_metrics.json",
            "metrics",
        )
        deployment_rows = _load_collection(
            self._data_dir / "deployments" / "deployment_events.json",
            "deployment_events",
        )
        ticket_rows = _load_collection(
            self._data_dir / "tickets" / "tickets.json",
            "tickets",
        )
        alarms_by_id = _index_by_id(alarm_rows, "alarm_id")
        fingerprints: dict[str, str] = {}
        for alarm_id, row in alarms_by_id.items():
            fingerprint = fingerprint_from_record(row)
            if fingerprint and fingerprint not in fingerprints:
                fingerprints[fingerprint] = alarm_id
        self._equipment_by_site = _group_by(equipment_rows, "site_id")
        self._topology_by_site = _group_topology(topology_rows)
        self._alarms_by_id = alarms_by_id
        self._metrics_by_id = _index_by_id(metric_rows, "metric_id")
        self._deployments_by_id = _index_by_id(deployment_rows, "deployment_id")
        self._tickets_by_id = _index_by_id(ticket_rows, "ticket_id")
        incident_rows = _load_collection(
            self._data_dir / "ground_truth" / "expected_incidents.json",
            "incidents",
        )
        self._incidents_by_id = _index_by_id(
            [_operational_incident(row, sites_by_id) for row in incident_rows],
            "incident_id",
        )
        self._alarm_fingerprints = fingerprints
        self._sites_by_id = sites_by_id


def _load_collection(path: Path, key: str) -> list[dict[str, Any]]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    rows = payload.get(key, [])
    if not isinstance(rows, list):
        return []
    return [row for row in rows if isinstance(row, dict)]


def _index_by_id(rows: list[dict[str, Any]], key: str) -> dict[str, dict[str, Any]]:
    indexed: dict[str, dict[str, Any]] = {}
    for row in rows:
        identifier = row.get(key)
        if isinstance(identifier, str) and identifier.strip():
            indexed[identifier.strip()] = row
    return indexed


def _group_by(rows: list[dict[str, Any]], key: str) -> dict[str, list[dict[str, Any]]]:
    grouped: dict[str, list[dict[str, Any]]] = {}
    for row in rows:
        identifier = row.get(key)
        if isinstance(identifier, str) and identifier.strip():
            grouped.setdefault(identifier.strip(), []).append(row)
    return grouped


_INCIDENT_META: dict[str, dict[str, str]] = {
    "INC-OUTAGE-001": {
        "severity": "critical",
        "status": "OPEN",
        "priority": "P1",
        "title": "SITE-003 synthetic backhaul isolation",
        "created_at": "2026-10-19T01:13:00+00:00",
    },
    "INC-CONGESTION-001": {
        "severity": "major",
        "status": "INVESTIGATING",
        "priority": "P2",
        "title": "SITE-007 synthetic radio congestion",
        "created_at": "2026-10-19T01:07:00+00:00",
    },
    "INC-DEPLOY-001": {
        "severity": "major",
        "status": "AWAITING_APPROVAL",
        "priority": "P2",
        "title": "SITE-012 synthetic post-deployment degradation",
        "created_at": "2026-10-19T04:18:00+00:00",
    },
}


def _operational_incident(
    row: Mapping[str, Any],
    sites_by_id: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    incident_id = str(row["incident_id"])
    site_id = str(row["site_id"])
    meta = _INCIDENT_META.get(incident_id, {})
    site = sites_by_id.get(site_id) or {}
    created = meta.get("created_at", "2026-10-19T00:00:00+00:00")
    return {
        "incident_id": incident_id,
        "title": meta.get("title") or incident_id,
        "description": f"Synthetic evaluation label: {row.get('expected_cause')}. Not a verified root cause.",
        "severity": meta.get("severity", "major"),
        "status": meta.get("status", "OPEN"),
        "site_id": site_id,
        "site_name": site.get("site_name"),
        "affected_sites": [site_id],
        "scenario_id": row.get("scenario_id"),
        "priority": meta.get("priority", "P2"),
        "evidence_alarm_ids": list(row.get("evidence_alarm_ids") or []),
        "created_at": created,
        "updated_at": created,
        "synthetic": True,
    }


def _group_topology(rows: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    grouped: dict[str, list[dict[str, Any]]] = {}
    for row in rows:
        for key in ("source_id", "target_id"):
            identifier = row.get(key)
            if isinstance(identifier, str) and identifier.strip().startswith("SITE-"):
                grouped.setdefault(identifier.strip(), []).append(row)
    return grouped

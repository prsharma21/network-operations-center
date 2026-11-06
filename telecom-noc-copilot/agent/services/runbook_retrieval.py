"""Deterministic local runbook retrieval (no Bedrock/LLM).

Matches alarm codes / scenario IDs against ``data/runbooks/runbook_catalog.json``.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

_PROJECT_ROOT = Path(__file__).resolve().parents[2]
_DEFAULT_CATALOG = _PROJECT_ROOT / "data" / "runbooks" / "runbook_catalog.json"


@lru_cache
def _load_catalog(path: str) -> list[dict[str, Any]]:
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    documents = payload.get("documents", [])
    return [doc for doc in documents if isinstance(doc, dict)]


def retrieve_runbook_passages(
    *,
    alarm_codes: list[str] | None = None,
    scenario_id: str | None = None,
    incident_id: str | None = None,
    limit: int = 3,
    catalog_path: Path | None = None,
) -> list[dict[str, Any]]:
    path = catalog_path or _DEFAULT_CATALOG
    docs = _load_catalog(str(path))
    codes = {code.upper() for code in (alarm_codes or [])}
    scored: list[tuple[int, dict[str, Any]]] = []
    for doc in docs:
        score = 0
        doc_alarms = {str(item).upper() for item in (doc.get("alarm_types") or [])}
        if codes and doc_alarms & codes:
            score += 3 * len(codes & doc_alarms)
        related_scenarios = set(doc.get("related_scenario_ids") or [])
        if scenario_id and scenario_id in related_scenarios:
            score += 5
        related_incidents = set(doc.get("related_incident_ids") or [])
        if incident_id and incident_id in related_incidents:
            score += 4
        if score <= 0:
            continue
        passage = {
            "document_id": doc.get("document_id"),
            "title": doc.get("title"),
            "source_ref": doc.get("source_ref"),
            "body": doc.get("body"),
            "steps": list(doc.get("steps") or [])[:5],
            "technology": list(doc.get("technology") or []),
            "alarm_types": list(doc.get("alarm_types") or []),
            "kpis": list(doc.get("kpi_definitions") or []),
            "related_incident_ids": list(doc.get("related_incident_ids") or []),
            "related_postmortems": list(doc.get("related_postmortems") or []),
            "score": score,
            "synthetic": True,
        }
        scored.append((score, passage))
    scored.sort(key=lambda item: (-item[0], str(item[1].get("document_id"))))
    return [item[1] for item in scored[: max(1, limit)]]

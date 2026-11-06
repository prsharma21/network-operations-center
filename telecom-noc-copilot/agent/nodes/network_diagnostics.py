"""Network Diagnostics specialist node.

Day 18 collects site inventory, telemetry, topology, and deployments into an
evidence bundle. Offline runs read the synthetic JSON fixtures. Observed facts
are kept separate from missing data, contradictions, and inferences.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from agent.nodes._helpers import append_error, append_finding, mark_status
from agent.runtime.state import InvestigationState
from agent.services.evidence import build_evidence_bundle

_PROJECT_ROOT = Path(__file__).resolve().parents[2]


def _load_json(relative: str, key: str | None = None):
    path = _PROJECT_ROOT / relative
    payload = json.loads(path.read_text(encoding="utf-8"))
    if key is None:
        return payload
    return payload.get(key, [])


def _fetch_from_fixtures(site_id: str) -> dict[str, Any]:
    sites = _load_json("data/sites/sites.json", "sites")
    site = next((row for row in sites if row.get("site_id") == site_id), {})
    metrics = [
        row
        for row in _load_json("data/telemetry/telemetry_metrics.json", "metrics")
        if row.get("site_id") == site_id
    ]
    deployments = [
        row
        for row in _load_json("data/deployments/deployment_events.json", "deployment_events")
        if row.get("site_id") == site_id
    ]
    links = [
        row
        for row in _load_json("data/topology/network_topology.json", "links")
        if site_id in {row.get("source_id"), row.get("target_id")}
    ]
    return {
        "site_context": site,
        "telemetry": metrics,
        "deployments": deployments,
        "topology": {"links": links, "nodes": []},
    }


def network_diagnostics_node(state: InvestigationState) -> dict:
    updates: dict = mark_status(state, "network_diagnostics", "running")
    updates["workflow_status"] = "diagnosing"
    site_id = str((state.get("incident") or {}).get("site_id") or "")
    if not site_id:
        failure = append_error(state, "network_diagnostics", "Missing site_id on incident.")
        failure.update(mark_status(state, "network_diagnostics", "failed"))
        failure["next_action"] = "supervisor"
        return failure

    try:
        # Deterministic offline path uses synthetic fixtures. Live Day-15 tools can be
        # enabled later by injecting an async client outside unit tests.
        bundle = _fetch_from_fixtures(site_id)

        evidence = build_evidence_bundle(
            incident=dict(state.get("incident") or {}),
            alarms=list(state.get("alarms") or []),
            site_context=bundle["site_context"],
            telemetry=bundle["telemetry"],
            deployments=bundle["deployments"],
            topology=bundle["topology"],
        )
        updates["site_context"] = bundle["site_context"]
        updates["telemetry"] = bundle["telemetry"]
        updates["deployments"] = bundle["deployments"]
        updates["topology"] = bundle["topology"]
        updates["evidence_bundle"] = evidence
        updates["diagnostics_complete"] = True
        updates["findings"] = append_finding(
            state,
            {
                "node": "network_diagnostics",
                "summary": (
                    f"Collected site={bool(bundle['site_context'])}, "
                    f"metrics={len(bundle['telemetry'])}, "
                    f"deployments={len(bundle['deployments'])}, "
                    f"topology_links={len(bundle['topology'].get('links') or [])}, "
                    f"facts={len(evidence['observed_facts'])}, "
                    f"missing={len(evidence['missing'])}, "
                    f"contradictions={len(evidence['contradictions'])}."
                ),
                "evidence_refs": list(evidence["event_ids"][:12]),
            },
        )
        updates.update(mark_status({**state, **updates}, "network_diagnostics", "completed"))  # type: ignore[arg-type]
        updates["next_action"] = "root_cause_analysis"
        return updates
    except Exception as exc:  # noqa: BLE001
        failure = append_error(state, "network_diagnostics", str(exc))
        failure.update(mark_status(state, "network_diagnostics", "failed"))
        failure["next_action"] = "supervisor"
        return failure

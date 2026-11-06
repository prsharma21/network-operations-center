"""Day 18 evidence bundle: observed facts, gaps, and contradictions.

Inferences are stored separately so a timestamp overlap is not presented as a
proven cause.
"""

from __future__ import annotations

from typing import Any

_UNREACHABLE = {"SITE_UNREACHABLE", "BACKHAUL_LINK_DOWN"}
_CONFIG = {"CONFIGURATION_MISMATCH", "POST_DEPLOYMENT_KPI_DEGRADATION", "ACCESSIBILITY_DEGRADATION"}


def _alarm_codes(incident: dict[str, Any], alarms: list[dict[str, Any]]) -> set[str]:
    codes = {str(code).upper() for code in (incident.get("alarm_codes") or [])}
    for row in alarms:
        code = row.get("alarm_code") or row.get("alarm_type")
        if code:
            codes.add(str(code).upper())
    return codes


def _fact(
    *,
    fact_id: str,
    category: str,
    title: str,
    detail: str,
    timestamp: str,
    source_event_id: str,
    source: str,
) -> dict[str, Any]:
    return {
        "id": fact_id,
        "category": category,
        "title": title,
        "detail": detail,
        "timestamp": timestamp or "",
        "source_event_id": source_event_id,
        "source": source,
        "provenance": "observed",
    }


def build_evidence_bundle(
    *,
    incident: dict[str, Any],
    alarms: list[dict[str, Any]],
    site_context: dict[str, Any],
    telemetry: list[dict[str, Any]],
    deployments: list[dict[str, Any]],
    topology: dict[str, Any],
) -> dict[str, Any]:
    """Collect timestamped evidence and separate facts from inferences."""
    site_id = str(incident.get("site_id") or site_context.get("site_id") or "")
    codes = _alarm_codes(incident, alarms)
    facts: list[dict[str, Any]] = []
    missing: list[str] = []
    contradictions: list[dict[str, Any]] = []
    inferences: list[dict[str, str]] = []

    if site_context:
        facts.append(
            _fact(
                fact_id=f"site:{site_id}",
                category="inventory",
                title=f"Site {site_id} inventory",
                detail=(
                    f"Status {site_context.get('status') or 'unknown'}, "
                    f"technology {site_context.get('technology') or 'unknown'}, "
                    f"backhaul {site_context.get('backhaul_type') or 'unknown'}."
                ),
                timestamp=str(incident.get("window_start") or ""),
                source_event_id=site_id or "site",
                source="site inventory",
            )
        )
    else:
        missing.append(f"No site inventory record for {site_id or 'unknown site'}.")

    if not alarms:
        missing.append("No alarm rows were available for this incident.")
    for row in alarms:
        alarm_id = str(row.get("alarm_id") or "")
        if not alarm_id:
            continue
        facts.append(
            _fact(
                fact_id=f"alarm:{alarm_id}",
                category="alarm",
                title=str(row.get("alarm_code") or row.get("alarm_type") or "alarm"),
                detail=str(row.get("message") or row.get("description") or ""),
                timestamp=str(row.get("timestamp") or ""),
                source_event_id=alarm_id,
                source="alarm",
            )
        )

    if not telemetry:
        missing.append(f"No telemetry samples for {site_id or 'this site'}.")
    for sample in telemetry:
        metric_id = str(sample.get("metric_id") or sample.get("timestamp") or "metric")
        abnormal = str(sample.get("state") or "").lower() == "abnormal" or _sample_is_abnormal(sample)
        if not abnormal:
            continue
        facts.append(
            _fact(
                fact_id=f"metric:{metric_id}",
                category="metric",
                title="KPI sample",
                detail=_metric_detail(sample),
                timestamp=str(sample.get("timestamp") or ""),
                source_event_id=metric_id,
                source="telemetry",
            )
        )

    links = list((topology or {}).get("links") or [])
    if not links:
        missing.append(f"No topology links mention {site_id or 'this site'}.")
    for link in links:
        link_id = str(link.get("link_id") or link.get("source_id") or "link")
        facts.append(
            _fact(
                fact_id=f"link:{link_id}",
                category="topology",
                title="Topology link",
                detail=(
                    f"{link.get('source_id')} -> {link.get('target_id')} "
                    f"status {link.get('status') or link.get('link_status') or 'recorded'}."
                ),
                timestamp=str(link.get("timestamp") or incident.get("window_start") or ""),
                source_event_id=link_id,
                source="topology",
            )
        )

    if not deployments:
        missing.append(f"No deployment events for {site_id or 'this site'}.")
    for deployment in deployments:
        deployment_id = str(deployment.get("deployment_id") or "deployment")
        facts.append(
            _fact(
                fact_id=f"deployment:{deployment_id}",
                category="deployment",
                title=f"Deployment {deployment_id}",
                detail=(
                    f"Status {deployment.get('status') or 'unknown'}. "
                    f"{deployment.get('notes') or ''}"
                ).strip(),
                timestamp=str(deployment.get("timestamp") or ""),
                source_event_id=deployment_id,
                source="deployment",
            )
        )

    site_status = str(site_context.get("status") or "").lower()
    if site_status in {"up", "in_service"} and codes & _UNREACHABLE:
        contradictions.append(
            {
                "id": "site-up-vs-unreachable",
                "detail": (
                    f"Inventory status is {site_status}, while alarms include "
                    f"{', '.join(sorted(codes & _UNREACHABLE))}."
                ),
            }
        )
    clean_deployments = [
        row
        for row in deployments
        if str(row.get("status") or "") == "completed"
    ]
    if clean_deployments and codes & _CONFIG:
        contradictions.append(
            {
                "id": "clean-deploy-vs-config-alarm",
                "detail": (
                    "A deployment is recorded as completed while configuration "
                    "or post-deployment alarms are present."
                ),
            }
        )
    normal_samples = [row for row in telemetry if str(row.get("state") or "").lower() == "normal"]
    if normal_samples and "critical" in {str(row.get("severity") or "").lower() for row in alarms}:
        contradictions.append(
            {
                "id": "normal-kpi-vs-critical-alarm",
                "detail": "At least one telemetry sample is normal while a critical alarm is active.",
            }
        )

    if alarms and deployments:
        inferences.append(
            {
                "id": "time-overlap",
                "detail": (
                    "Alarm and deployment timestamps can overlap. "
                    "Overlap is correlation, not proof of causation."
                ),
            }
        )
    if incident.get("expected_cause"):
        inferences.append(
            {
                "id": "scenario-label",
                "detail": (
                    f"Synthetic scenario label: {incident.get('expected_cause')}. "
                    "This label is not an observed fact."
                ),
            }
        )

    event_ids = [item["source_event_id"] for item in facts if item.get("source_event_id")]
    return {
        "site_id": site_id,
        "observed_facts": facts,
        "missing": missing,
        "contradictions": contradictions,
        "inferences": inferences,
        "event_ids": event_ids,
    }


def _sample_is_abnormal(sample: dict[str, Any]) -> bool:
    latency = sample.get("latency_ms")
    throughput = sample.get("throughput_mbps")
    utilization = sample.get("utilization_pct")
    dropped = sample.get("dropped_call_rate_pct")
    if isinstance(latency, (int, float)) and latency >= 900:
        return True
    if isinstance(throughput, (int, float)) and throughput <= 20:
        return True
    if isinstance(utilization, (int, float)) and utilization >= 92:
        return True
    if isinstance(dropped, (int, float)) and dropped >= 5:
        return True
    return False


def _metric_detail(sample: dict[str, Any]) -> str:
    parts: list[str] = []
    for key in ("latency_ms", "throughput_mbps", "utilization_pct", "dropped_call_rate_pct"):
        if sample.get(key) is not None:
            parts.append(f"{key}={sample.get(key)}")
    state = sample.get("state")
    if state:
        parts.append(f"state={state}")
    return ", ".join(parts) or "Telemetry sample recorded."

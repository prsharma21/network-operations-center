"""Day 19 ranked root-cause hypotheses.

The top hypothesis is a rule-and-runbook candidate. A second hypothesis is kept
so contradictory evidence can rule it down. Neither entry is a verified cause.
"""

from __future__ import annotations

from typing import Any, Callable

from agent.services.bedrock_model import narrate_investigation

CAUSATION_NOTE = (
    "Timestamps that overlap show correlation only. They are not proof that one event caused another."
)

_ALTERNATIVES = {
    "backhaul": {
        "title": "Radio unit failure",
        "hypothesis": "Cell availability loss could be a radio fault rather than transport isolation.",
    },
    "radio": {
        "title": "Backhaul degradation",
        "hypothesis": "Elevated latency could be a transport problem rather than radio congestion.",
    },
    "configuration": {
        "title": "Capacity congestion",
        "hypothesis": "KPI degradation could be busy-hour congestion unrelated to the deployment.",
    },
}


def build_root_cause(
    *,
    incident: dict[str, Any],
    alarms: list[dict[str, Any]],
    telemetry: list[dict[str, Any]],
    deployments: list[dict[str, Any]],
    passages: list[dict[str, Any]],
    evidence_bundle: dict[str, Any] | None = None,
    narrator: Callable[[dict[str, Any]], dict[str, str] | None] | None = None,
) -> dict[str, Any]:
    signals = _signal_hits(incident, alarms, telemetry, deployments)
    component = str(incident.get("component") or "unknown")
    hypothesis = str(
        incident.get("expected_cause")
        or (f"Runbook-supported hypothesis from {passages[0].get('document_id')}" if passages else "")
        or f"Undetermined; component={component}"
    )
    title = str(incident.get("title") or f"{incident.get('site_id') or 'Site'} {component} hypothesis")
    level = "high" if incident.get("scenario_id") and (passages or signals) else "medium"
    supporting = _supporting_refs(alarms, telemetry, deployments, passages)
    contradictory = _primary_contradictions(evidence_bundle or {}, component, alarms, telemetry)
    primary = _candidate(
        rank=1,
        title=title,
        hypothesis=hypothesis,
        level=level,
        supporting=supporting,
        contradictory=contradictory,
    )
    alternative = _alternative_candidate(component, alarms, telemetry, deployments)
    result = {
        "candidate_cause": hypothesis,
        "confidence": level,
        "supporting_signals": signals,
        "runbook_refs": [item.get("source_ref") for item in passages],
        "candidates": [primary, alternative],
        "causation_note": CAUSATION_NOTE,
        "method": "deterministic_rules_and_runbooks",
        "llm_used": False,
    }
    writer = narrator if narrator is not None else narrate_investigation
    narrative = writer(
        {
            "incident_id": incident.get("incident_id"),
            "site_id": incident.get("site_id"),
            "component": component,
            "rule_hypothesis": hypothesis,
            "signals": signals,
            "alarm_codes": list(incident.get("alarm_codes") or [])[:12],
            "runbooks": [item.get("title") for item in passages[:2]],
            "contradictions": [
                item.get("detail") for item in ((evidence_bundle or {}).get("contradictions") or [])
            ][:4],
        }
    )
    if narrative:
        result["narrative"] = narrative["narrative"]
        result["summary"] = narrative["summary"]
        result["llm_used"] = True
        result["method"] = "rules_with_bedrock_narrative"
    return result


def _candidate(
    *,
    rank: int,
    title: str,
    hypothesis: str,
    level: str,
    supporting: list[dict[str, str]],
    contradictory: list[dict[str, str]],
) -> dict[str, Any]:
    score = {"high": 82, "medium": 58, "low": 34}[level]
    uncertainty = {"high": "low", "medium": "medium", "low": "high"}[level]
    return {
        "rank": rank,
        "title": title,
        "hypothesis": hypothesis,
        "confidence_pct": score,
        "uncertainty": uncertainty,
        "supporting": supporting,
        "contradictory": contradictory,
    }


def _signal_hits(
    incident: dict[str, Any],
    alarms: list[dict[str, Any]],
    telemetry: list[dict[str, Any]],
    deployments: list[dict[str, Any]],
) -> list[str]:
    signals: list[str] = []
    codes = {str(code).upper() for code in (incident.get("alarm_codes") or [])}
    for row in alarms:
        code = row.get("alarm_code") or row.get("alarm_type")
        if code:
            codes.add(str(code).upper())
    if "SITE_UNREACHABLE" in codes or "BACKHAUL_LINK_DOWN" in codes:
        signals.append("site unreachable / backhaul down alarms present")
    if "HIGH_PRB_UTILIZATION" in codes or "HIGH_UTILIZATION" in codes:
        signals.append("radio utilization alarms present")
    if "CONFIGURATION_MISMATCH" in codes or "POST_DEPLOYMENT_KPI_DEGRADATION" in codes:
        signals.append("post-deployment / configuration alarms present")

    for sample in telemetry[:20]:
        name = str(sample.get("metric_name") or "")
        value = sample.get("value")
        if name == "latency_ms" and isinstance(value, (int, float)) and value >= 900:
            signals.append("latency unavailable/high")
        if name == "throughput_mbps" and isinstance(value, (int, float)) and value <= 20:
            signals.append("throughput degraded/zero")
        if name == "utilization_pct" and isinstance(value, (int, float)) and value >= 92:
            signals.append("utilization above 92%")
        if name == "dropped_call_rate_pct" and isinstance(value, (int, float)) and value >= 5:
            signals.append("dropped-call rate elevated")
        if sample.get("latency_ms") is not None and float(sample["latency_ms"]) >= 900:
            signals.append("latency unavailable/high")
        if sample.get("throughput_mbps") is not None and float(sample["throughput_mbps"]) <= 20:
            signals.append("throughput degraded/zero")
        if sample.get("utilization_pct") is not None and float(sample["utilization_pct"]) >= 92:
            signals.append("utilization above 92%")
        if sample.get("dropped_call_rate_pct") is not None and float(sample["dropped_call_rate_pct"]) >= 5:
            signals.append("dropped-call rate elevated")

    for deployment in deployments:
        status = str(deployment.get("status") or "")
        if "warning" in status or status == "failed":
            signals.append("deployment completed with warning/failed")
    return sorted(set(signals))


def _ref(source_event_id: str, source: str, timestamp: str, summary: str) -> dict[str, str]:
    return {
        "source_event_id": source_event_id,
        "source": source,
        "timestamp": timestamp,
        "summary": summary,
    }


def _supporting_refs(
    alarms: list[dict[str, Any]],
    telemetry: list[dict[str, Any]],
    deployments: list[dict[str, Any]],
    passages: list[dict[str, Any]],
) -> list[dict[str, str]]:
    refs: list[dict[str, str]] = []
    for row in alarms:
        alarm_id = str(row.get("alarm_id") or "")
        if not alarm_id:
            continue
        refs.append(
            _ref(
                alarm_id,
                "alarm",
                str(row.get("timestamp") or ""),
                f"{row.get('alarm_code') or row.get('alarm_type')}: {row.get('message') or ''}".strip(),
            )
        )
    for sample in telemetry:
        if str(sample.get("state") or "").lower() != "abnormal" and not _abnormal(sample):
            continue
        metric_id = str(sample.get("metric_id") or sample.get("timestamp") or "metric")
        refs.append(
            _ref(
                metric_id,
                "telemetry",
                str(sample.get("timestamp") or ""),
                "Abnormal KPI sample recorded for this site.",
            )
        )
        break
    for deployment in deployments:
        status = str(deployment.get("status") or "")
        if "warning" in status or status == "failed":
            refs.append(
                _ref(
                    str(deployment.get("deployment_id") or "deployment"),
                    "deployment",
                    str(deployment.get("timestamp") or ""),
                    f"Deployment status {status}.",
                )
            )
    for passage in passages[:1]:
        refs.append(
            _ref(
                str(passage.get("document_id") or "runbook"),
                "runbook",
                "",
                str(passage.get("title") or "Matching runbook passage"),
            )
        )
    return refs


def _primary_contradictions(
    evidence_bundle: dict[str, Any],
    component: str,
    alarms: list[dict[str, Any]],
    telemetry: list[dict[str, Any]],
) -> list[dict[str, str]]:
    refs = [
        _ref(
            str(item.get("id") or "contradiction"),
            "evidence review",
            "",
            str(item.get("detail") or ""),
        )
        for item in (evidence_bundle.get("contradictions") or [])
        if item.get("detail")
    ]
    codes = {str(row.get("alarm_code") or "").upper() for row in alarms}
    utilization_high = any(
        isinstance(row.get("utilization_pct"), (int, float)) and float(row["utilization_pct"]) >= 92
        for row in telemetry
    )
    if component == "backhaul" and utilization_high and "HIGH_PRB_UTILIZATION" not in codes:
        refs.append(
            _ref(
                "kpi-utilization",
                "telemetry",
                "",
                "High utilization is present, which a pure transport outage does not explain by itself.",
            )
        )
    return refs


def _alternative_candidate(
    component: str,
    alarms: list[dict[str, Any]],
    telemetry: list[dict[str, Any]],
    deployments: list[dict[str, Any]],
) -> dict[str, Any]:
    spec = _ALTERNATIVES.get(
        component,
        {
            "title": "Undifferentiated site fault",
            "hypothesis": "The same symptoms could belong to a different component than the grouped alarms.",
        },
    )
    contradictory = _alternative_contradictions(component, alarms, telemetry, deployments)
    return _candidate(
        rank=2,
        title=str(spec["title"]),
        hypothesis=str(spec["hypothesis"]),
        level="low",
        supporting=[],
        contradictory=contradictory,
    )


def _alternative_contradictions(
    component: str,
    alarms: list[dict[str, Any]],
    telemetry: list[dict[str, Any]],
    deployments: list[dict[str, Any]],
) -> list[dict[str, str]]:
    codes = {str(row.get("alarm_code") or row.get("alarm_type") or "").upper() for row in alarms}
    refs: list[dict[str, str]] = []
    if component == "backhaul" and {"BACKHAUL_LINK_DOWN", "SITE_UNREACHABLE"} & codes:
        alarm = next(
            (
                row
                for row in alarms
                if str(row.get("alarm_code") or "").upper() in {"BACKHAUL_LINK_DOWN", "SITE_UNREACHABLE"}
            ),
            None,
        )
        refs.append(
            _ref(
                str((alarm or {}).get("alarm_id") or "backhaul-alarm"),
                "alarm",
                str((alarm or {}).get("timestamp") or ""),
                "A backhaul or reachability alarm argues against a radio-only fault.",
            )
        )
    if component == "radio" and not ({"BACKHAUL_LINK_DOWN", "SITE_UNREACHABLE"} & codes):
        refs.append(
            _ref(
                "no-backhaul-alarm",
                "alarm",
                "",
                "No site-unreachable or backhaul-down alarm is in this group.",
            )
        )
    if component == "configuration":
        warned = next(
            (row for row in deployments if "warning" in str(row.get("status") or "") or row.get("status") == "failed"),
            None,
        )
        if warned is not None:
            refs.append(
                _ref(
                    str(warned.get("deployment_id") or "deployment"),
                    "deployment",
                    str(warned.get("timestamp") or ""),
                    "A warned or failed deployment is stronger evidence than congestion alone.",
                )
            )
        if "CONFIGURATION_MISMATCH" in codes:
            refs.append(
                _ref(
                    "config-alarm",
                    "alarm",
                    "",
                    "A configuration mismatch alarm is present.",
                )
            )
    if not refs:
        refs.append(
            _ref(
                "insufficient-support",
                "evidence review",
                "",
                "This alternative has no independent supporting evidence in the collected bundle.",
            )
        )
    return refs


def _abnormal(sample: dict[str, Any]) -> bool:
    checks = (
        ("latency_ms", 900, True),
        ("throughput_mbps", 20, False),
        ("utilization_pct", 92, True),
        ("dropped_call_rate_pct", 5, True),
    )
    for key, limit, high in checks:
        value = sample.get(key)
        if not isinstance(value, (int, float)):
            continue
        if high and value >= limit:
            return True
        if not high and value <= limit:
            return True
    return False

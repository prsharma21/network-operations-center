"""Deterministic severity classification. No LLM is used.

Policy
------
``severity`` on the stored alarm is always the **source** value from the
payload so existing API consumers keep seeing the OSS-reported severity.

``source_severity`` is that same value, stored explicitly.

``computed_severity`` is derived as follows:
1. If any KPI sample fields are present, apply ``DEMO_KPI_THRESHOLDS``. The
   most severe matching band wins.
2. Else if ``alarm_code`` is in ``DEMO_ALARM_CODE_SEVERITY``, use that mapping.
3. Else (unknown alarm type) copy the source severity.

When source and computed values differ, both are kept and ingest logs the
conflict. Source is never overwritten.
"""

from __future__ import annotations

from app.schemas.enums import Severity
from app.services.demo_kpi_thresholds import (
    DEMO_ALARM_CODE_SEVERITY,
    DEMO_KPI_THRESHOLDS,
    DemoKpiThresholds,
)

_SEVERITY_RANK: dict[Severity, int] = {
    Severity.CLEARED: 0,
    Severity.INFO: 1,
    Severity.WARNING: 2,
    Severity.MINOR: 3,
    Severity.MAJOR: 4,
    Severity.CRITICAL: 5,
}


def _worse(left: Severity | None, right: Severity | None) -> Severity | None:
    if left is None:
        return right
    if right is None:
        return left
    return left if _SEVERITY_RANK[left] >= _SEVERITY_RANK[right] else right


def severity_from_kpis(
    *,
    latency_ms: float | None = None,
    throughput_mbps: float | None = None,
    utilization_pct: float | None = None,
    dropped_call_rate_pct: float | None = None,
    thresholds: DemoKpiThresholds = DEMO_KPI_THRESHOLDS,
) -> Severity | None:
    """Return the worst KPI band, or None when no supplied KPI crosses a band."""
    computed: Severity | None = None
    if latency_ms is not None:
        if latency_ms >= thresholds.latency_unavailable_ms:
            computed = _worse(computed, Severity.CRITICAL)
        elif latency_ms >= thresholds.latency_critical_ms:
            computed = _worse(computed, Severity.CRITICAL)
        elif latency_ms >= thresholds.latency_warning_ms:
            computed = _worse(computed, Severity.WARNING)
    if throughput_mbps is not None:
        if throughput_mbps <= thresholds.throughput_critical_mbps:
            computed = _worse(computed, Severity.CRITICAL)
        elif throughput_mbps <= thresholds.throughput_warning_mbps:
            computed = _worse(computed, Severity.WARNING)
    if utilization_pct is not None:
        if utilization_pct >= thresholds.utilization_critical_pct:
            computed = _worse(computed, Severity.CRITICAL)
        elif utilization_pct >= thresholds.utilization_warning_pct:
            computed = _worse(computed, Severity.WARNING)
    if dropped_call_rate_pct is not None:
        if dropped_call_rate_pct >= thresholds.dropped_call_critical_pct:
            computed = _worse(computed, Severity.CRITICAL)
        elif dropped_call_rate_pct >= thresholds.dropped_call_warning_pct:
            computed = _worse(computed, Severity.WARNING)
    return computed


def compute_alarm_severity(
    *,
    source_severity: Severity,
    alarm_code: str,
    latency_ms: float | None = None,
    throughput_mbps: float | None = None,
    utilization_pct: float | None = None,
    dropped_call_rate_pct: float | None = None,
    thresholds: DemoKpiThresholds = DEMO_KPI_THRESHOLDS,
) -> tuple[Severity, str]:
    """Return ``(computed_severity, rule_applied)``."""
    has_kpi = any(
        value is not None
        for value in (latency_ms, throughput_mbps, utilization_pct, dropped_call_rate_pct)
    )
    if has_kpi:
        from_kpis = severity_from_kpis(
            latency_ms=latency_ms,
            throughput_mbps=throughput_mbps,
            utilization_pct=utilization_pct,
            dropped_call_rate_pct=dropped_call_rate_pct,
            thresholds=thresholds,
        )
        if from_kpis is not None:
            return from_kpis, "kpi_threshold"
        # KPIs present but all below demo bands: still prefer the code map.
    mapped = DEMO_ALARM_CODE_SEVERITY.get(alarm_code.strip().upper())
    if mapped is not None:
        return mapped, "alarm_code_map"
    return source_severity, "source_fallback"

"""Illustrative demo KPI thresholds for deterministic alarm severity.

Source
------
Copied from the synthetic runbook ``RB-KPI-THRESHOLDS`` in
``data/runbooks/runbook_catalog.json``. They classify training telemetry.
They are **not** production telecom vendor limits.

Latency (ms), higher is worse:
    warning >= 80, critical >= 150, unavailable >= 900 (treated as critical)

Throughput (Mbps), lower is worse:
    warning <= 80, critical <= 20

Utilization (%):
    warning >= 70, critical >= 92

Dropped-call rate (%):
    warning >= 2, critical >= 5
"""

from __future__ import annotations

from dataclasses import dataclass

from app.schemas.enums import Severity


@dataclass(frozen=True, slots=True)
class DemoKpiThresholds:
    latency_warning_ms: float = 80.0
    latency_critical_ms: float = 150.0
    latency_unavailable_ms: float = 900.0
    throughput_warning_mbps: float = 80.0
    throughput_critical_mbps: float = 20.0
    utilization_warning_pct: float = 70.0
    utilization_critical_pct: float = 92.0
    dropped_call_warning_pct: float = 2.0
    dropped_call_critical_pct: float = 5.0


DEMO_KPI_THRESHOLDS = DemoKpiThresholds()

# Alarm-code fallback when no KPI sample is supplied. Matches the synthetic
# alarm feed. Unknown codes fall through to the source severity.
DEMO_ALARM_CODE_SEVERITY: dict[str, Severity] = {
    "SITE_UNREACHABLE": Severity.CRITICAL,
    "BACKHAUL_LINK_DOWN": Severity.CRITICAL,
    "CELL_AVAILABILITY_LOSS": Severity.CRITICAL,
    "HIGH_PRB_UTILIZATION": Severity.MAJOR,
    "HIGH_LATENCY": Severity.MAJOR,
    "THROUGHPUT_DEGRADATION": Severity.MAJOR,
    "DROPPED_CALLS_HIGH": Severity.MAJOR,
    "POST_DEPLOYMENT_KPI_DEGRADATION": Severity.MAJOR,
    "CONFIGURATION_MISMATCH": Severity.MAJOR,
    "ACCESSIBILITY_DEGRADATION": Severity.MAJOR,
    "LOW_THROUGHPUT": Severity.MAJOR,
    "HIGH_UTILIZATION": Severity.MAJOR,
    "TEMPERATURE_WARNING": Severity.WARNING,
    "POWER_WARNING": Severity.WARNING,
    "SYNC_FAILURE": Severity.WARNING,
    "PACKET_LOSS": Severity.WARNING,
}

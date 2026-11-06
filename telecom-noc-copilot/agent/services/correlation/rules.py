"""Deterministic severity, priority, component and scenario rules."""

from __future__ import annotations

from dataclasses import dataclass

# Highest severity wins when ranking.
SEVERITY_RANK: dict[str, int] = {
    "cleared": 0,
    "info": 1,
    "warning": 2,
    "minor": 3,
    "major": 4,
    "critical": 5,
}

PRIORITY_BY_SEVERITY: dict[str, str] = {
    "critical": "P1",
    "major": "P2",
    "minor": "P3",
    "warning": "P3",
    "info": "P4",
    "cleared": "P4",
}

# Alarm code → network component family used for grouping.
COMPONENT_BY_ALARM_CODE: dict[str, str] = {
    "SITE_UNREACHABLE": "backhaul",
    "BACKHAUL_LINK_DOWN": "backhaul",
    "CELL_AVAILABILITY_LOSS": "backhaul",
    "HIGH_PRB_UTILIZATION": "radio",
    "HIGH_UTILIZATION": "radio",
    "HIGH_LATENCY": "radio",
    "THROUGHPUT_DEGRADATION": "radio",
    "LOW_THROUGHPUT": "radio",
    "DROPPED_CALLS_HIGH": "radio",
    "POST_DEPLOYMENT_KPI_DEGRADATION": "configuration",
    "CONFIGURATION_MISMATCH": "configuration",
    "ACCESSIBILITY_DEGRADATION": "configuration",
    "SYNC_FAILURE": "synchronization",
    "TEMPERATURE_WARNING": "environment",
    "POWER_WARNING": "power",
}

@dataclass(frozen=True, slots=True)
class ScenarioRule:
    scenario_id: str
    scenario_name: str
    component: str
    required_codes: frozenset[str]
    expected_cause: str
    title_template: str


SCENARIO_RULES: tuple[ScenarioRule, ...] = (
    ScenarioRule(
        scenario_id="SCN-OUTAGE-01",
        scenario_name="site_outage",
        component="backhaul",
        required_codes=frozenset(
            {"SITE_UNREACHABLE", "BACKHAUL_LINK_DOWN", "CELL_AVAILABILITY_LOSS"}
        ),
        expected_cause="Simulated backhaul link failure",
        title_template="{site_id} correlated backhaul isolation",
    ),
    ScenarioRule(
        scenario_id="SCN-CONGESTION-01",
        scenario_name="congestion",
        component="radio",
        required_codes=frozenset(
            {
                "HIGH_PRB_UTILIZATION",
                "HIGH_LATENCY",
                "THROUGHPUT_DEGRADATION",
                "DROPPED_CALLS_HIGH",
            }
        ),
        expected_cause="Simulated radio capacity congestion",
        title_template="{site_id} correlated radio congestion",
    ),
    ScenarioRule(
        scenario_id="SCN-DEPLOY-01",
        scenario_name="deployment_related_fault",
        component="configuration",
        required_codes=frozenset(
            {
                "POST_DEPLOYMENT_KPI_DEGRADATION",
                "CONFIGURATION_MISMATCH",
                "ACCESSIBILITY_DEGRADATION",
            }
        ),
        expected_cause="Simulated configuration regression after deployment",
        title_template="{site_id} correlated post-deployment degradation",
    ),
)

# Stable incident IDs for known synthetic scenarios (ground-truth aligned).
SCENARIO_INCIDENT_IDS: dict[str, str] = {
    "SCN-OUTAGE-01": "INC-OUTAGE-001",
    "SCN-CONGESTION-01": "INC-CONGESTION-001",
    "SCN-DEPLOY-01": "INC-DEPLOY-001",
}


def normalize_severity(value: str | None) -> str:
    text = (value or "info").strip().lower()
    return text if text in SEVERITY_RANK else "info"


def worst_severity(values: list[str]) -> str:
    if not values:
        return "info"
    return max(values, key=lambda item: SEVERITY_RANK.get(normalize_severity(item), 0))


def priority_for_severity(severity: str) -> str:
    return PRIORITY_BY_SEVERITY.get(normalize_severity(severity), "P3")


def component_for_alarm_code(alarm_code: str | None, explicit: str | None = None) -> str:
    if explicit and explicit.strip():
        return explicit.strip().lower()
    code = (alarm_code or "").strip().upper()
    return COMPONENT_BY_ALARM_CODE.get(code, "unknown")


def match_scenario(alarm_codes: set[str]) -> ScenarioRule | None:
    """Return the first scenario whose required codes are a subset of the group."""
    upper = {code.upper() for code in alarm_codes}
    for rule in SCENARIO_RULES:
        if rule.required_codes.issubset(upper):
            return rule
    return None


def correlation_fingerprint(
    *,
    site_id: str,
    component: str,
    scenario_id: str | None,
    alarm_codes: list[str],
) -> str:
    codes = ",".join(sorted({code.upper() for code in alarm_codes}))
    scenario = scenario_id or "GENERIC"
    return f"{site_id}|{component}|{scenario}|{codes}"

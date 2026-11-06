"""Deterministic alarm correlation engine (Day 16).

Groups alarms by site, region, component and time window, applies severity /
priority rules, links evidence to incident candidates, and suppresses duplicates.
No LLM is used.
"""

from __future__ import annotations

import json
import logging
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path
from typing import Sequence

from agent.services.correlation.models import (
    AlarmEvent,
    CorrelatedIncident,
    CorrelationResult,
    ExistingIncident,
)
from agent.services.correlation.rules import (
    SCENARIO_INCIDENT_IDS,
    component_for_alarm_code,
    correlation_fingerprint,
    match_scenario,
    normalize_severity,
    priority_for_severity,
    worst_severity,
)

logger = logging.getLogger("telecom_noc_copilot.agent.correlation")

ACTIVE_STATUSES = frozenset({"active", "acknowledged"})
DEFAULT_WINDOW = timedelta(hours=6)


class AlarmCorrelationEngine:
    """Repeatable, deterministic incident correlation."""

    def __init__(
        self,
        *,
        time_window: timedelta = DEFAULT_WINDOW,
        min_alarms_per_group: int = 2,
    ) -> None:
        self.time_window = time_window
        self.min_alarms_per_group = min_alarms_per_group

    def correlate(
        self,
        alarms: Sequence[AlarmEvent | dict],
        *,
        existing_incidents: Sequence[ExistingIncident | dict] | None = None,
    ) -> CorrelationResult:
        parsed = [self._as_alarm(item) for item in alarms]
        existing = [self._as_existing(item) for item in (existing_incidents or [])]
        open_existing = [
            item
            for item in existing
            if item.status.upper() not in {"CLOSED", "RESOLVED", "CLEARED"}
        ]

        active = [item for item in parsed if item.status.lower() in ACTIVE_STATUSES]
        skipped_cleared = len(parsed) - len(active)

        groups = self._group_alarms(active)
        created: list[CorrelatedIncident] = []
        duplicates = 0
        known_fingerprints = {
            item.correlation_fingerprint
            for item in open_existing
            if item.correlation_fingerprint
        }
        # Also index by site + overlapping evidence for dedupe without fingerprint.
        evidence_index = {
            item.incident_id: set(item.evidence_alarm_ids) for item in open_existing
        }

        for group in groups:
            candidate = self._build_incident(group)
            if candidate is None:
                continue

            duplicate_id = self._find_duplicate(
                candidate,
                open_existing=open_existing,
                known_fingerprints=known_fingerprints,
                evidence_index=evidence_index,
            )
            if duplicate_id is not None:
                candidate = candidate.model_copy(
                    update={"is_duplicate": True, "duplicate_of": duplicate_id, "status": "DUPLICATE"}
                )
                duplicates += 1
            else:
                known_fingerprints.add(candidate.correlation_fingerprint)
                evidence_index[candidate.incident_id] = set(candidate.evidence_alarm_ids)
                open_existing.append(
                    ExistingIncident(
                        incident_id=candidate.incident_id,
                        site_id=candidate.site_id,
                        status=candidate.status,
                        scenario_id=candidate.scenario_id,
                        evidence_alarm_ids=list(candidate.evidence_alarm_ids),
                        correlation_fingerprint=candidate.correlation_fingerprint,
                    )
                )
            created.append(candidate)

        created.sort(key=lambda item: (item.window_start, item.incident_id))
        result = CorrelationResult(
            incidents=created,
            groups_evaluated=len(groups),
            created_count=sum(1 for item in created if not item.is_duplicate),
            duplicate_count=duplicates,
            skipped_cleared_count=skipped_cleared,
        )
        logger.info(
            "event=alarm_correlation groups=%s created=%s duplicates=%s",
            result.groups_evaluated,
            result.created_count,
            result.duplicate_count,
        )
        return result

    def correlate_from_json_files(
        self,
        alarms_path: Path,
        *,
        incidents_path: Path | None = None,
    ) -> CorrelationResult:
        alarms_payload = json.loads(alarms_path.read_text(encoding="utf-8"))
        alarm_rows = alarms_payload.get("alarms", alarms_payload)
        existing_rows: list[dict] = []
        if incidents_path and incidents_path.exists():
            incident_payload = json.loads(incidents_path.read_text(encoding="utf-8"))
            for row in incident_payload.get("incidents", []):
                existing_rows.append(
                    {
                        "incident_id": row["incident_id"],
                        "site_id": row["site_id"],
                        "status": "OPEN",
                        "scenario_id": row.get("scenario_id"),
                        "evidence_alarm_ids": list(row.get("evidence_alarm_ids") or []),
                        "correlation_fingerprint": None,
                    }
                )
        return self.correlate(alarm_rows, existing_incidents=existing_rows)

    def _group_alarms(self, alarms: Sequence[AlarmEvent]) -> list[list[AlarmEvent]]:
        """Group by site + region + component, then split by time window."""
        buckets: dict[tuple[str, str, str], list[AlarmEvent]] = defaultdict(list)
        for alarm in alarms:
            component = component_for_alarm_code(alarm.alarm_code, alarm.network_component)
            region = (alarm.region or "").strip() or "unknown"
            # Prefer explicit correlation_key when present to keep scenario clusters together.
            if alarm.correlation_key:
                key = (alarm.site_id, region, f"key:{alarm.correlation_key}")
            else:
                key = (alarm.site_id, region, component)
            buckets[key].append(alarm)

        groups: list[list[AlarmEvent]] = []
        for rows in buckets.values():
            ordered = sorted(rows, key=lambda item: (item.timestamp, item.alarm_id))
            groups.extend(self._split_by_time_window(ordered))
        return groups

    def _split_by_time_window(self, ordered: Sequence[AlarmEvent]) -> list[list[AlarmEvent]]:
        if not ordered:
            return []
        windows: list[list[AlarmEvent]] = []
        current: list[AlarmEvent] = [ordered[0]]
        anchor = ordered[0].timestamp
        for alarm in ordered[1:]:
            if alarm.timestamp - anchor <= self.time_window:
                current.append(alarm)
            else:
                windows.append(current)
                current = [alarm]
                anchor = alarm.timestamp
        windows.append(current)
        return [group for group in windows if len(group) >= self.min_alarms_per_group]

    def _build_incident(self, group: Sequence[AlarmEvent]) -> CorrelatedIncident | None:
        if len(group) < self.min_alarms_per_group:
            return None
        site_id = group[0].site_id
        region = group[0].region
        site_name = group[0].site_name
        codes = [item.alarm_code for item in group]
        code_set = set(codes)
        scenario = match_scenario(code_set)
        if scenario is not None:
            component = scenario.component
            scenario_id = scenario.scenario_id
            scenario_name = scenario.scenario_name
            expected_cause = scenario.expected_cause
            title = scenario.title_template.format(site_id=site_id)
            incident_id = SCENARIO_INCIDENT_IDS.get(
                scenario_id, f"INC-{site_id}-{scenario_name.upper()}"
            )
        else:
            component = component_for_alarm_code(group[0].alarm_code, group[0].network_component)
            # Require homogeneous component for generic clusters.
            components = {
                component_for_alarm_code(item.alarm_code, item.network_component) for item in group
            }
            if len(components) > 1 and not group[0].correlation_key:
                return None
            component = next(iter(components))
            scenario_id = group[0].scenario_id
            scenario_name = None
            expected_cause = None
            title = f"{site_id} correlated {component} alarms"
            incident_id = f"INC-{site_id}-{component.upper()}-{group[0].timestamp.strftime('%Y%m%d%H%M')}"

        severity = worst_severity([item.severity for item in group])
        priority = priority_for_severity(severity)
        evidence = sorted({item.alarm_id for item in group})
        window_start = min(item.timestamp for item in group)
        window_end = max(item.timestamp for item in group)
        fingerprint = correlation_fingerprint(
            site_id=site_id,
            component=component,
            scenario_id=scenario_id,
            alarm_codes=codes,
        )
        correlation_key = group[0].correlation_key
        description = (
            f"Deterministic correlation of {len(evidence)} alarms "
            f"on {site_id} ({component}) within {self.time_window}."
        )
        if expected_cause:
            description = f"{description} Label: {expected_cause}."

        return CorrelatedIncident(
            incident_id=incident_id,
            site_id=site_id,
            site_name=site_name,
            region=region,
            title=title,
            description=description,
            severity=normalize_severity(severity),
            priority=priority,  # type: ignore[arg-type]
            status="OPEN",
            scenario_id=scenario_id,
            scenario_name=scenario_name,
            component=component,
            evidence_alarm_ids=evidence,
            alarm_codes=sorted({code.upper() for code in codes}),
            correlation_key=correlation_key,
            correlation_fingerprint=fingerprint,
            window_start=window_start,
            window_end=window_end,
            expected_cause=expected_cause,
        )

    def _find_duplicate(
        self,
        candidate: CorrelatedIncident,
        *,
        open_existing: Sequence[ExistingIncident],
        known_fingerprints: set[str],
        evidence_index: dict[str, set[str]],
    ) -> str | None:
        if candidate.correlation_fingerprint in known_fingerprints:
            for item in open_existing:
                if item.correlation_fingerprint == candidate.correlation_fingerprint:
                    return item.incident_id
            return next(
                (
                    item.incident_id
                    for item in open_existing
                    if item.site_id == candidate.site_id
                    and item.scenario_id == candidate.scenario_id
                ),
                candidate.incident_id,
            )

        candidate_evidence = set(candidate.evidence_alarm_ids)
        for incident_id, evidence in evidence_index.items():
            if not evidence:
                continue
            overlap = len(candidate_evidence & evidence) / max(len(candidate_evidence), 1)
            if candidate.site_id and overlap >= 0.5:
                owner = next((item for item in open_existing if item.incident_id == incident_id), None)
                if owner and owner.site_id == candidate.site_id:
                    return incident_id
        # Same stable scenario incident id already open.
        for item in open_existing:
            if item.incident_id == candidate.incident_id:
                return item.incident_id
        return None

    @staticmethod
    def _as_alarm(value: AlarmEvent | dict) -> AlarmEvent:
        if isinstance(value, AlarmEvent):
            return value
        payload = dict(value)
        if "alarm_code" not in payload and "alarm_type" in payload:
            payload["alarm_code"] = payload["alarm_type"]
        if "message" not in payload and "description" in payload:
            payload["message"] = payload["description"]
        return AlarmEvent.model_validate(payload)

    @staticmethod
    def _as_existing(value: ExistingIncident | dict) -> ExistingIncident:
        if isinstance(value, ExistingIncident):
            return value
        return ExistingIncident.model_validate(value)

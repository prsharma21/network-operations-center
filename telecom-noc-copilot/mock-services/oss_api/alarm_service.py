"""Alarm ingest and query on top of the OSS JSON repository.

Ingest steps: validate (Pydantic) → site lookup → enrich from OSS →
fingerprint + ID uniqueness → persist. Severity rules compute a derived
value without replacing the source severity.
"""

from __future__ import annotations

import logging
import time
from datetime import UTC, datetime

from pydantic import ValidationError

from app.schemas.alarm import AlarmListResponse, NetworkAlarm, NetworkAlarmCreate
from app.schemas.enums import AlarmStatus, Severity
from app.services.alarm_enrichment import enrich_alarm_from_site
from app.services.alarm_fingerprint import build_alarm_fingerprint
from app.services.alarm_severity import compute_alarm_severity
from app.utils.logging import log_structured
from oss_api.exceptions import DuplicateAlarm, SiteNotFound
from oss_api.repository import OssDataRepository

logger = logging.getLogger("telecom_noc_copilot.alarms")


class OssAlarmService:
    def __init__(self, repository: OssDataRepository) -> None:
        self._repository = repository

    def create_alarm(
        self,
        payload: NetworkAlarmCreate,
        request_id: str | None = None,
    ) -> NetworkAlarm:
        started = time.perf_counter()
        source_event_id = payload.source_event_id or payload.alarm_id
        try:
            site = self._repository.get_site_record(payload.site_id)
            if site is None:
                log_structured(
                    logger,
                    "alarm_ingest",
                    request_id=request_id,
                    alarm_id=payload.alarm_id,
                    source_event_id=source_event_id,
                    site_id=payload.site_id,
                    validation="ok",
                    duplicate="n/a",
                    enrichment="skipped",
                    outcome="site_not_found",
                    error_category="missing_site",
                    duration_ms=_duration_ms(started),
                )
                raise SiteNotFound(payload.site_id)

            data = payload.model_dump(exclude_none=True)
            if not data.get("alarm_id") and payload.source_event_id:
                data["alarm_id"] = payload.source_event_id
            data["source_event_id"] = source_event_id
            data["source_severity"] = payload.severity

            enriched = enrich_alarm_from_site(data, site)
            replaced = enriched.pop("_enrichment_replaced", [])

            computed, rule = compute_alarm_severity(
                source_severity=payload.severity,
                alarm_code=payload.alarm_code,
                latency_ms=payload.latency_ms,
                throughput_mbps=payload.throughput_mbps,
                utilization_pct=payload.utilization_pct,
                dropped_call_rate_pct=payload.dropped_call_rate_pct,
            )
            enriched["computed_severity"] = computed
            enriched["severity_rule"] = rule
            # Keep the consumer-facing severity as the source value.
            enriched["severity"] = payload.severity

            alarm = NetworkAlarm.model_validate(enriched)
            fingerprint = build_alarm_fingerprint(
                site_id=alarm.site_id,
                alarm_code=alarm.alarm_code,
                timestamp=alarm.timestamp,
                network_component=alarm.network_component,
            )
            stored = self._repository.add_alarm_record(
                alarm.model_dump(mode="json"),
                fingerprint=fingerprint,
            )
            created = NetworkAlarm.model_validate(stored)
            log_structured(
                logger,
                "alarm_ingest",
                request_id=request_id,
                alarm_id=created.alarm_id,
                source_event_id=source_event_id,
                site_id=created.site_id,
                validation="ok",
                duplicate="new",
                enrichment="ok",
                enrichment_replaced=",".join(replaced) if replaced else "none",
                computed_severity=created.computed_severity,
                source_severity=created.source_severity,
                severity_conflict=created.computed_severity is not None
                and created.computed_severity != created.source_severity,
                outcome="created",
                duration_ms=_duration_ms(started),
            )
            return created
        except DuplicateAlarm as exc:
            log_structured(
                logger,
                "alarm_ingest",
                request_id=request_id,
                alarm_id=payload.alarm_id or exc.alarm_id,
                source_event_id=source_event_id,
                site_id=payload.site_id,
                validation="ok",
                duplicate=exc.reason,
                enrichment="ok",
                outcome="duplicate",
                error_category="duplicate",
                existing_alarm_id=exc.alarm_id,
                duration_ms=_duration_ms(started),
            )
            raise
        except SiteNotFound:
            raise
        except Exception:
            log_structured(
                logger,
                "alarm_ingest",
                request_id=request_id,
                alarm_id=payload.alarm_id,
                source_event_id=source_event_id,
                site_id=payload.site_id,
                validation="ok",
                outcome="error",
                error_category="ingest_failure",
                duration_ms=_duration_ms(started),
            )
            raise

    def list_alarms(
        self,
        *,
        site_id: str | None = None,
        severity: Severity | None = None,
        region: str | None = None,
        status: AlarmStatus | None = None,
        page: int = 1,
        page_size: int = 25,
    ) -> AlarmListResponse:
        alarms = self._validated_alarms()
        if site_id:
            wanted = site_id.strip()
            alarms = [item for item in alarms if item.site_id == wanted]
        if severity is not None:
            alarms = [item for item in alarms if item.severity is severity]
        if status is not None:
            alarms = [item for item in alarms if item.status is status]
        if region and region.strip():
            wanted_region = region.strip().casefold()
            alarms = [
                item
                for item in alarms
                if (item.region or "").casefold() == wanted_region
            ]

        alarms.sort(key=lambda item: (item.timestamp, item.alarm_id), reverse=True)
        total = len(alarms)
        start = (page - 1) * page_size
        page_items = alarms[start : start + page_size]
        as_of = alarms[0].timestamp if alarms else datetime.now(UTC)
        return AlarmListResponse(
            items=page_items,
            total=total,
            page=page,
            page_size=page_size,
            as_of=as_of,
        )

    def _validated_alarms(self) -> list[NetworkAlarm]:
        parsed: list[NetworkAlarm] = []
        for row in self._repository.list_alarm_records():
            try:
                parsed.append(NetworkAlarm.model_validate(row))
            except ValidationError:
                continue
        return parsed


def _duration_ms(started: float) -> float:
    return round((time.perf_counter() - started) * 1000, 2)

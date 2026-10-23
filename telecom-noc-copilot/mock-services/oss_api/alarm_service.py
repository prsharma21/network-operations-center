"""In-memory alarm ingest and query on top of the OSS JSON repository."""

from __future__ import annotations

from datetime import UTC, datetime

from pydantic import ValidationError

from app.schemas.alarm import AlarmListResponse, NetworkAlarm, NetworkAlarmCreate
from app.schemas.enums import AlarmStatus, Severity
from oss_api.exceptions import DuplicateAlarm, SiteNotFound
from oss_api.repository import JsonOssRepository


class OssAlarmService:
    def __init__(self, repository: JsonOssRepository) -> None:
        self._repository = repository

    def create_alarm(self, payload: NetworkAlarmCreate) -> NetworkAlarm:
        site = self._repository.get_site_record(payload.site_id)
        if site is None:
            raise SiteNotFound(payload.site_id)

        data = payload.model_dump(exclude_none=True)
        if not data.get("region"):
            region = site.get("region")
            if isinstance(region, str) and region.strip():
                data["region"] = region.strip()
        if not data.get("alarm_id"):
            data["alarm_id"] = self._repository.next_alarm_id()

        alarm = NetworkAlarm.model_validate(data)
        try:
            stored = self._repository.add_alarm_record(alarm.model_dump(mode="json"))
        except DuplicateAlarm:
            raise
        return NetworkAlarm.model_validate(stored)

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

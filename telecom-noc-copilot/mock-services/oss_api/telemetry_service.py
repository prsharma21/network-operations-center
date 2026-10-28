"""In-memory telemetry ingest and query on top of the OSS JSON repository."""

from __future__ import annotations

from datetime import UTC, datetime

from pydantic import ValidationError

from app.schemas.telemetry import (
    TelemetryListResponse,
    TelemetryMetric,
    TelemetryMetricCreate,
)
from oss_api.exceptions import InvalidTimeRange, SiteNotFound
from oss_api.repository import OssDataRepository


class OssTelemetryService:
    def __init__(self, repository: OssDataRepository) -> None:
        self._repository = repository

    def create_metric(self, payload: TelemetryMetricCreate) -> TelemetryMetric:
        if self._repository.get_site_record(payload.site_id) is None:
            raise SiteNotFound(payload.site_id)

        data = payload.model_dump(exclude_none=True)
        if not data.get("metric_id"):
            data["metric_id"] = self._repository.next_metric_id()

        metric = TelemetryMetric.model_validate(data)
        stored = self._repository.add_metric_record(metric.model_dump(mode="json"))
        return TelemetryMetric.model_validate(stored)

    def list_site_metrics(
        self,
        site_id: str,
        *,
        start_time: datetime | None = None,
        end_time: datetime | None = None,
        page: int = 1,
        page_size: int = 25,
    ) -> TelemetryListResponse:
        requested = site_id.strip()
        if not requested or self._repository.get_site_record(requested) is None:
            raise SiteNotFound(site_id)

        if start_time is not None and end_time is not None and start_time > end_time:
            raise InvalidTimeRange()

        metrics = [
            item for item in self._validated_metrics() if item.site_id == requested
        ]
        if start_time is not None:
            metrics = [item for item in metrics if item.timestamp >= start_time]
        if end_time is not None:
            metrics = [item for item in metrics if item.timestamp <= end_time]

        metrics.sort(key=lambda item: (item.timestamp, item.metric_id))
        total = len(metrics)
        start = (page - 1) * page_size
        page_items = metrics[start : start + page_size]
        as_of = metrics[-1].timestamp if metrics else datetime.now(UTC)
        return TelemetryListResponse(
            items=page_items,
            total=total,
            page=page,
            page_size=page_size,
            as_of=as_of,
        )

    def _validated_metrics(self) -> list[TelemetryMetric]:
        parsed: list[TelemetryMetric] = []
        for row in self._repository.list_metric_records():
            try:
                parsed.append(TelemetryMetric.model_validate(row))
            except ValidationError:
                continue
        return parsed

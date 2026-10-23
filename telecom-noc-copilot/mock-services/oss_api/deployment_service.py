"""Read-only deployment listing on top of the OSS JSON repository."""

from __future__ import annotations

from datetime import UTC, datetime

from pydantic import ValidationError

from app.schemas.deployment import DeploymentEvent, DeploymentListResponse
from app.schemas.enums import DeploymentStatus
from oss_api.exceptions import InvalidTimeRange
from oss_api.repository import JsonOssRepository


class OssDeploymentService:
    def __init__(self, repository: JsonOssRepository) -> None:
        self._repository = repository

    def list_deployments(
        self,
        *,
        site_id: str | None = None,
        region: str | None = None,
        status: DeploymentStatus | None = None,
        start_time: datetime | None = None,
        end_time: datetime | None = None,
        page: int = 1,
        page_size: int = 25,
    ) -> DeploymentListResponse:
        if start_time is not None and end_time is not None and start_time > end_time:
            raise InvalidTimeRange()

        deployments = self._validated_deployments()
        if site_id and site_id.strip():
            wanted = site_id.strip()
            deployments = [item for item in deployments if item.site_id == wanted]
        if status is not None:
            deployments = [item for item in deployments if item.status is status]
        if start_time is not None:
            deployments = [item for item in deployments if item.timestamp >= start_time]
        if end_time is not None:
            deployments = [item for item in deployments if item.timestamp <= end_time]
        if region and region.strip():
            wanted_region = region.strip().casefold()
            deployments = [
                item
                for item in deployments
                if self._site_region(item.site_id).casefold() == wanted_region
            ]

        deployments.sort(key=lambda item: (item.timestamp, item.deployment_id), reverse=True)
        total = len(deployments)
        start = (page - 1) * page_size
        page_items = deployments[start : start + page_size]
        as_of = deployments[0].timestamp if deployments else datetime.now(UTC)
        return DeploymentListResponse(
            items=page_items,
            total=total,
            page=page,
            page_size=page_size,
            as_of=as_of,
        )

    def _site_region(self, site_id: str) -> str:
        site = self._repository.get_site_record(site_id)
        region = site.get("region") if site else None
        return region.strip() if isinstance(region, str) else ""

    def _validated_deployments(self) -> list[DeploymentEvent]:
        parsed: list[DeploymentEvent] = []
        for row in self._repository.list_deployment_records():
            try:
                parsed.append(DeploymentEvent.model_validate(row))
            except ValidationError:
                continue
        return parsed

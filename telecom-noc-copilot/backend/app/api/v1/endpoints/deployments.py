"""Mock OSS read-only deployment listing."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import get_deployment_service
from app.schemas.deployment import DeploymentListResponse
from app.schemas.enums import DeploymentStatus
from app.utils.timestamps import parse_optional_utc_datetime
from oss_api.deployment_service import OssDeploymentService
from oss_api.exceptions import InvalidTimeRange

router = APIRouter(tags=["deployments"])


def _optional_utc_query(value: str | None) -> datetime | None:
    try:
        return parse_optional_utc_datetime(value)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(exc),
        ) from exc


@router.get(
    "/deployments",
    response_model=DeploymentListResponse,
    responses={422: {"description": "Invalid filter, time range, or pagination values"}},
)
def list_deployments(
    service: Annotated[OssDeploymentService, Depends(get_deployment_service)],
    site_id: str | None = Query(default=None),
    region: str | None = Query(default=None),
    status_filter: DeploymentStatus | None = Query(default=None, alias="status"),
    start_time: str | None = Query(default=None),
    end_time: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100, alias="page_size"),
) -> DeploymentListResponse:
    try:
        return service.list_deployments(
            site_id=site_id,
            region=region,
            status=status_filter,
            start_time=_optional_utc_query(start_time),
            end_time=_optional_utc_query(end_time),
            page=page,
            page_size=page_size,
        )
    except InvalidTimeRange as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(exc),
        ) from exc

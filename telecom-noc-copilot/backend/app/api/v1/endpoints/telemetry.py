"""Mock OSS telemetry ingest and site metric list routes."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from app.api.deps import get_telemetry_service
from app.schemas.telemetry import (
    TelemetryListResponse,
    TelemetryMetric,
    TelemetryMetricCreate,
)
from app.utils.timestamps import parse_utc_datetime
from oss_api.exceptions import DuplicateMetric, InvalidTimeRange, SiteNotFound
from oss_api.telemetry_service import OssTelemetryService

router = APIRouter(tags=["telemetry"])


def _optional_utc_query(value: str | None) -> datetime | None:
    if value is None or not value.strip():
        return None
    try:
        return parse_utc_datetime(value)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(exc),
        ) from exc


@router.post(
    "/telemetry",
    response_model=TelemetryMetric,
    status_code=status.HTTP_201_CREATED,
    responses={
        404: {"description": "Referenced site_id is not in the synthetic OSS inventory"},
        409: {"description": "metric_id already exists"},
        422: {"description": "Request failed TelemetryMetric validation"},
    },
)
def create_metric(
    payload: TelemetryMetricCreate,
    response: Response,
    service: Annotated[OssTelemetryService, Depends(get_telemetry_service)],
) -> TelemetryMetric:
    try:
        created = service.create_metric(payload)
    except SiteNotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except DuplicateMetric as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    response.headers["Location"] = f"/telemetry/{created.metric_id}"
    return created


@router.get(
    "/sites/{site_id}/metrics",
    response_model=TelemetryListResponse,
    responses={
        404: {"description": "Site ID is not in the synthetic OSS inventory"},
        422: {"description": "Invalid time range or pagination values"},
    },
)
def list_site_metrics(
    site_id: str,
    service: Annotated[OssTelemetryService, Depends(get_telemetry_service)],
    start_time: str | None = Query(default=None),
    end_time: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100, alias="page_size"),
) -> TelemetryListResponse:
    try:
        return service.list_site_metrics(
            site_id,
            start_time=_optional_utc_query(start_time),
            end_time=_optional_utc_query(end_time),
            page=page,
            page_size=page_size,
        )
    except SiteNotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except InvalidTimeRange as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(exc),
        ) from exc


@router.get(
    "/telemetry",
    response_model=TelemetryListResponse,
    responses={422: {"description": "Invalid time range or pagination values"}},
)
def list_metrics(
    service: Annotated[OssTelemetryService, Depends(get_telemetry_service)],
    start_time: str | None = Query(default=None),
    end_time: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=100, ge=1, le=500, alias="page_size"),
) -> TelemetryListResponse:
    try:
        return service.list_metrics(
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

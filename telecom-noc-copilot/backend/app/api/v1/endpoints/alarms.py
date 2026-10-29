"""Mock OSS alarm ingest and list routes."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status

from app.api.deps import get_alarm_service
from app.schemas.alarm import AlarmListResponse, NetworkAlarm, NetworkAlarmCreate
from app.schemas.enums import AlarmStatus, Severity
from oss_api.alarm_service import OssAlarmService
from oss_api.exceptions import AlarmNotFound, DuplicateAlarm, SiteNotFound

router = APIRouter(tags=["alarms"])


@router.post(
    "/alarms",
    response_model=NetworkAlarm,
    response_model_exclude_none=True,
    status_code=status.HTTP_201_CREATED,
    responses={
        404: {"description": "Referenced site_id is not in the synthetic OSS inventory"},
        409: {"description": "alarm_id already exists"},
        422: {"description": "Request failed NetworkAlarm validation"},
    },
)
def create_alarm(
    payload: NetworkAlarmCreate,
    request: Request,
    response: Response,
    service: Annotated[OssAlarmService, Depends(get_alarm_service)],
) -> NetworkAlarm:
    request_id = getattr(request.state, "request_id", None)
    try:
        created = service.create_alarm(payload, request_id=request_id)
    except SiteNotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except DuplicateAlarm as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    response.headers["Location"] = f"/alarms/{created.alarm_id}"
    return created


@router.get(
    "/alarms",
    response_model=AlarmListResponse,
    response_model_exclude_none=True,
    responses={422: {"description": "Invalid filter or pagination values"}},
)
def list_alarms(
    service: Annotated[OssAlarmService, Depends(get_alarm_service)],
    site_id: str | None = Query(default=None),
    severity: Severity | None = Query(default=None),
    region: str | None = Query(default=None),
    status_filter: AlarmStatus | None = Query(default=None, alias="status"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100, alias="page_size"),
) -> AlarmListResponse:
    return service.list_alarms(
        site_id=site_id,
        severity=severity,
        region=region,
        status=status_filter,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/alarms/{alarm_id}",
    response_model=NetworkAlarm,
    response_model_exclude_none=True,
    responses={404: {"description": "Alarm ID is not in the catalog"}},
)
def get_alarm(
    alarm_id: str,
    service: Annotated[OssAlarmService, Depends(get_alarm_service)],
) -> NetworkAlarm:
    try:
        return service.get_alarm(alarm_id)
    except AlarmNotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

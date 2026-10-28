"""Incident list and detail. Investigate/approve/report are not implemented here."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import get_incident_service
from app.schemas.enums import IncidentLifecycleStatus
from app.schemas.incident import Incident, IncidentListResponse
from oss_api.exceptions import IncidentNotFound
from oss_api.incident_service import OssIncidentService

router = APIRouter(tags=["incidents"])


@router.get(
    "/incidents",
    response_model=IncidentListResponse,
    response_model_exclude_none=True,
)
def list_incidents(
    service: Annotated[OssIncidentService, Depends(get_incident_service)],
    site_id: str | None = Query(default=None),
    status_filter: IncidentLifecycleStatus | None = Query(default=None, alias="status"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100, alias="page_size"),
) -> IncidentListResponse:
    return service.list_incidents(
        site_id=site_id,
        status=status_filter,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/incidents/{incident_id}",
    response_model=Incident,
    response_model_exclude_none=True,
    responses={404: {"description": "Incident ID is not in the catalog"}},
)
def get_incident(
    incident_id: str,
    service: Annotated[OssIncidentService, Depends(get_incident_service)],
) -> Incident:
    try:
        return service.get_incident(incident_id)
    except IncidentNotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

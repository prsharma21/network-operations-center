"""Incident list, detail, investigation, and report retrieval."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import get_db_session, get_incident_service
from app.schemas.enums import IncidentLifecycleStatus
from app.schemas.incident import Incident, IncidentListResponse
from app.services.investigation_workflow import (
    InvestigationFailed,
    investigate_incident,
    load_report,
)
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


@router.post("/incidents/{incident_id}/investigate")
def investigate(
    incident_id: str,
    service: Annotated[OssIncidentService, Depends(get_incident_service)],
    db: Annotated[Any, Depends(get_db_session)],
) -> dict[str, Any]:
    try:
        return investigate_incident(incident_id, service.repository, db)
    except IncidentNotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except InvestigationFailed as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc


@router.get(
    "/incidents/{incident_id}/report",
    responses={404: {"description": "This incident has no stored investigation report"}},
)
def get_report(incident_id: str) -> dict[str, Any]:
    report = load_report(incident_id)
    if report is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No report is available for {incident_id}. Investigate the incident first.",
        )
    return report

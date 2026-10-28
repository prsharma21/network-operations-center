"""Mock OSS site configuration route.

Data comes from ``mock-services/oss_api`` (JSON repository). Persistence can
later swap in a PostgreSQL repository without changing this router.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import get_oss_service
from app.schemas.site import NetworkSite, SiteListResponse
from oss_api.exceptions import InvalidStoredSite, SiteNotFound
from oss_api.service import OssSiteService

router = APIRouter(tags=["sites"])


@router.get(
    "/sites",
    response_model=SiteListResponse,
    response_model_exclude_none=True,
)
def list_sites(
    service: Annotated[OssSiteService, Depends(get_oss_service)],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=100, ge=1, le=200, alias="page_size"),
) -> SiteListResponse:
    sites = service.list_sites()
    total = len(sites)
    start = (page - 1) * page_size
    return SiteListResponse(
        items=sites[start : start + page_size],
        total=total,
        page=page,
        page_size=page_size,
        as_of=datetime.now(UTC),
    )


@router.get(
    "/sites/{site_id}",
    response_model=NetworkSite,
    responses={
        404: {"description": "Site ID is not in the synthetic OSS inventory"},
        500: {"description": "Stored site record failed NetworkSite validation"},
    },
)
def get_site(
    site_id: str,
    service: Annotated[OssSiteService, Depends(get_oss_service)],
) -> NetworkSite:
    try:
        return service.get_site(site_id)
    except SiteNotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except InvalidStoredSite as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc

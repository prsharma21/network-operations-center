"""Read-only synthetic network topology routes."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import get_topology_service
from app.schemas.topology import TopologyListResponse
from oss_api.exceptions import SiteNotFound
from oss_api.topology_service import OssTopologyService

router = APIRouter(tags=["topology"])


@router.get(
    "/topology",
    response_model=TopologyListResponse,
    response_model_exclude_none=True,
    responses={
        404: {"description": "Referenced site_id is not in the synthetic OSS inventory"},
        422: {"description": "Invalid filter or pagination values"},
    },
)
def list_topology(
    service: Annotated[OssTopologyService, Depends(get_topology_service)],
    site_id: str | None = Query(default=None),
    region: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=100, ge=1, le=200, alias="page_size"),
) -> TopologyListResponse:
    try:
        return service.list_topology(
            site_id=site_id,
            region=region,
            page=page,
            page_size=page_size,
        )
    except SiteNotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

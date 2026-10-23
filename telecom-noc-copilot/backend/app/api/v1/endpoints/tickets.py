"""Mock OSS read-only ticket listing."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.api.deps import get_ticket_service
from app.schemas.enums import TicketPriority, TicketStatus
from app.schemas.ticket import TicketListResponse
from oss_api.ticket_service import OssTicketService

router = APIRouter(tags=["tickets"])


@router.get(
    "/tickets",
    response_model=TicketListResponse,
    responses={422: {"description": "Invalid filter or pagination values"}},
)
def list_tickets(
    service: Annotated[OssTicketService, Depends(get_ticket_service)],
    incident_id: str | None = Query(default=None),
    status_filter: TicketStatus | None = Query(default=None, alias="status"),
    priority: TicketPriority | None = Query(default=None),
    owner: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100, alias="page_size"),
) -> TicketListResponse:
    return service.list_tickets(
        incident_id=incident_id,
        status=status_filter,
        priority=priority,
        owner=owner,
        page=page,
        page_size=page_size,
    )

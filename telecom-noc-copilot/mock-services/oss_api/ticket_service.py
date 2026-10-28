"""Read-only ticket listing on top of the OSS JSON repository."""

from __future__ import annotations

from datetime import UTC, datetime

from pydantic import ValidationError

from app.schemas.enums import TicketPriority, TicketStatus
from app.schemas.ticket import Ticket, TicketListResponse
from oss_api.repository import OssDataRepository


class OssTicketService:
    def __init__(self, repository: OssDataRepository) -> None:
        self._repository = repository

    def list_tickets(
        self,
        *,
        incident_id: str | None = None,
        status: TicketStatus | None = None,
        priority: TicketPriority | None = None,
        owner: str | None = None,
        page: int = 1,
        page_size: int = 25,
    ) -> TicketListResponse:
        tickets = self._validated_tickets()
        if incident_id and incident_id.strip():
            wanted = incident_id.strip()
            tickets = [item for item in tickets if item.incident_id == wanted]
        if status is not None:
            tickets = [item for item in tickets if item.status is status]
        if priority is not None:
            tickets = [item for item in tickets if item.priority is priority]
        if owner and owner.strip():
            wanted_owner = owner.strip().casefold()
            tickets = [
                item for item in tickets if item.assigned_group.casefold() == wanted_owner
            ]

        tickets.sort(key=lambda item: (item.created_at, item.ticket_id), reverse=True)
        total = len(tickets)
        start = (page - 1) * page_size
        page_items = tickets[start : start + page_size]
        as_of = tickets[0].created_at if tickets else datetime.now(UTC)
        return TicketListResponse(
            items=page_items,
            total=total,
            page=page,
            page_size=page_size,
            as_of=as_of,
        )

    def _validated_tickets(self) -> list[Ticket]:
        parsed: list[Ticket] = []
        for row in self._repository.list_ticket_records():
            try:
                parsed.append(Ticket.model_validate(row))
            except ValidationError:
                continue
        return parsed

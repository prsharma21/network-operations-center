"""Ticket schemas aligned with ``data/tickets/tickets.json``."""

from __future__ import annotations

from pydantic import AliasChoices, BaseModel, Field

from app.schemas.common import MODEL_CONFIG, NonEmptyStr, SiteId, UtcDateTime
from app.schemas.enums import TicketPriority, TicketStatus


class Ticket(BaseModel):
    """Mock NOC ticket.

    Dataset field ``assigned_group`` is the owner. Request payloads may also
    send ``owner``. Dataset field ``description`` may also be sent as ``notes``.
    ``incident_id`` is optional because the current fixtures are site-scoped
    rather than incident-scoped.
    """

    model_config = MODEL_CONFIG

    ticket_id: NonEmptyStr
    site_id: SiteId
    title: NonEmptyStr
    priority: TicketPriority
    status: TicketStatus
    created_at: UtcDateTime
    assigned_group: NonEmptyStr = Field(validation_alias=AliasChoices("assigned_group", "owner"))
    description: NonEmptyStr = Field(validation_alias=AliasChoices("description", "notes"))
    incident_id: NonEmptyStr | None = None
    scenario_id: NonEmptyStr | None = None
    synthetic: bool = True

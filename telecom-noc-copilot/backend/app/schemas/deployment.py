"""Deployment event schemas aligned with ``data/deployments/deployment_events.json``."""

from __future__ import annotations

from pydantic import AliasChoices, BaseModel, Field

from app.schemas.common import MODEL_CONFIG, NonEmptyStr, SiteId, UtcDateTime
from app.schemas.enums import DeploymentChangeType, DeploymentStatus


class DeploymentEvent(BaseModel):
    """Simulated software or configuration change.

    Dataset fields ``version_after`` and ``notes`` are the source of truth.
    Request payloads may also send ``version`` and ``change_summary``.
    """

    model_config = MODEL_CONFIG

    deployment_id: NonEmptyStr
    site_id: SiteId
    timestamp: UtcDateTime
    change_type: DeploymentChangeType
    version_before: NonEmptyStr
    version_after: NonEmptyStr = Field(validation_alias=AliasChoices("version_after", "version"))
    status: DeploymentStatus
    notes: NonEmptyStr = Field(validation_alias=AliasChoices("notes", "change_summary"))
    change_ticket: NonEmptyStr | None = None
    synthetic: bool = True


class DeploymentListResponse(BaseModel):
    """Paginated GET /deployments payload."""

    model_config = MODEL_CONFIG

    items: list[DeploymentEvent]
    total: int = Field(ge=0)
    page: int = Field(ge=1)
    page_size: int = Field(ge=1)
    as_of: UtcDateTime

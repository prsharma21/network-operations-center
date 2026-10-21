"""Network site schemas aligned with ``data/sites/sites.json``."""

from __future__ import annotations

from pydantic import BaseModel, Field

from app.schemas.common import MODEL_CONFIG, NonEmptyStr, SiteId, UtcDateTime
from app.schemas.enums import SiteStatus


class NetworkSite(BaseModel):
    """Cell site inventory record from the synthetic OSS dataset.

    ``created_at`` is optional because the current JSON fixtures do not include
    timestamps. When present it must be timezone-aware ISO 8601.
    """

    model_config = MODEL_CONFIG

    site_id: SiteId
    site_name: NonEmptyStr
    region: NonEmptyStr
    technology: NonEmptyStr
    vendor: NonEmptyStr
    status: SiteStatus
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    site_type: NonEmptyStr | None = None
    criticality: NonEmptyStr | None = None
    backhaul_type: NonEmptyStr | None = None
    known_scenario: NonEmptyStr | None = None
    synthetic: bool = True
    created_at: UtcDateTime | None = None

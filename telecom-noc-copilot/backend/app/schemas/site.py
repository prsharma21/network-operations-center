"""Network site schemas aligned with ``data/sites/sites.json``."""

from __future__ import annotations

from pydantic import BaseModel, Field

from app.schemas.common import MODEL_CONFIG, NonEmptyStr, SiteId, UtcDateTime
from app.schemas.enums import SiteStatus


class SiteEquipment(BaseModel):
    """OSS equipment row from ``data/oss/oss_inventory.json``."""

    model_config = MODEL_CONFIG

    equipment_id: NonEmptyStr
    site_id: SiteId
    component: NonEmptyStr
    vendor: NonEmptyStr
    software_version: NonEmptyStr
    operational_state: NonEmptyStr
    synthetic: bool = True


class TopologyReference(BaseModel):
    """Backhaul / aggregation link from ``data/topology/network_topology.json``."""

    model_config = MODEL_CONFIG

    link_id: NonEmptyStr
    source_id: NonEmptyStr
    target_id: NonEmptyStr
    link_type: NonEmptyStr
    status: NonEmptyStr
    capacity_mbps: float = Field(ge=0)
    synthetic: bool = True


class NetworkSite(BaseModel):
    """Cell site configuration from the synthetic OSS dataset.

    ``created_at`` is optional because the current JSON fixtures do not include
    timestamps. When present it must be timezone-aware ISO 8601.

    ``equipment`` and ``topology`` default to empty lists so site-only fixture
    records still validate. ``GET /sites/{site_id}`` fills them from OSS JSON.
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
    equipment: list[SiteEquipment] = Field(default_factory=list)
    topology: list[TopologyReference] = Field(default_factory=list)

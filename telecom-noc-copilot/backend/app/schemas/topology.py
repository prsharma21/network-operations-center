"""Network topology schemas backed by ``data/topology/network_topology.json``."""

from __future__ import annotations

from pydantic import BaseModel, Field

from app.schemas.common import MODEL_CONFIG, NonEmptyStr, UtcDateTime
from app.schemas.site import TopologyReference


class TopologyNode(BaseModel):
    """Site or aggregation node referenced by a topology link."""

    model_config = MODEL_CONFIG

    node_id: NonEmptyStr
    node_kind: NonEmptyStr = Field(description="site, aggregation, or other synthetic node kind")
    site_id: NonEmptyStr | None = None
    site_name: NonEmptyStr | None = None
    region: NonEmptyStr | None = None


class TopologyListResponse(BaseModel):
    """Paginated GET /topology payload from the synthetic OSS dataset."""

    model_config = MODEL_CONFIG

    items: list[TopologyReference]
    nodes: list[TopologyNode] = Field(default_factory=list)
    total: int = Field(ge=0)
    page: int = Field(ge=1)
    page_size: int = Field(ge=1)
    as_of: UtcDateTime

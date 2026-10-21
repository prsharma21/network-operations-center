"""Telemetry KPI schemas aligned with ``data/telemetry/telemetry_metrics.json``."""

from __future__ import annotations

from pydantic import AliasChoices, BaseModel, Field

from app.schemas.common import MODEL_CONFIG, NonEmptyStr, SiteId, UtcDateTime
from app.schemas.enums import TelemetryState


class TelemetryMetric(BaseModel):
    """Time-series KPI sample for a site.

    Ranges follow the synthetic dataset: utilization and dropped-call rate are
    percentages (0–100). Latency and throughput cannot be negative. The outage
    fixture uses latency_ms=999.0 with throughput 0, which is valid.
    """

    model_config = MODEL_CONFIG

    metric_id: NonEmptyStr
    site_id: SiteId
    timestamp: UtcDateTime
    latency_ms: float = Field(ge=0, description="Round-trip latency in milliseconds.")
    throughput_mbps: float = Field(ge=0, description="User-plane throughput in Mbps.")
    utilization_pct: float = Field(
        ge=0,
        le=100,
        description="Radio / resource utilization percent.",
    )
    dropped_call_rate_pct: float = Field(
        ge=0,
        le=100,
        validation_alias=AliasChoices("dropped_call_rate_pct", "dropped_call_rate"),
        description="Dropped-call rate percent.",
    )
    sample_window_minutes: int = Field(default=5, gt=0)
    state: TelemetryState = TelemetryState.NORMAL
    synthetic: bool = True

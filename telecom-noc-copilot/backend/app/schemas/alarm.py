"""Network alarm schemas aligned with ``data/alarms/alarms.json``."""

from __future__ import annotations

from pydantic import AliasChoices, BaseModel, Field

from app.schemas.common import MODEL_CONFIG, NonEmptyStr, SiteId, UtcDateTime
from app.schemas.enums import AlarmStatus, Severity


class NetworkAlarm(BaseModel):
    """Fault event from the synthetic alarm feed.

    Dataset field ``alarm_code`` is the source of truth. Request payloads may
    also send ``alarm_type``. Dataset field ``message`` may also be sent as
    ``description``.
    """

    model_config = MODEL_CONFIG

    alarm_id: NonEmptyStr
    site_id: SiteId
    alarm_code: NonEmptyStr = Field(
        validation_alias=AliasChoices("alarm_code", "alarm_type"),
        description="Alarm type / code (SITE_UNREACHABLE, HIGH_LATENCY, ...).",
    )
    severity: Severity
    status: AlarmStatus
    timestamp: UtcDateTime
    message: NonEmptyStr = Field(validation_alias=AliasChoices("message", "description"))
    region: NonEmptyStr | None = None
    source: NonEmptyStr | None = None
    scenario_id: NonEmptyStr | None = None
    correlation_key: NonEmptyStr | None = None
    synthetic: bool = True
    source_event_id: NonEmptyStr | None = None
    site_name: NonEmptyStr | None = None
    technology: NonEmptyStr | None = None
    vendor: NonEmptyStr | None = None
    network_component: NonEmptyStr | None = Field(
        default=None,
        validation_alias=AliasChoices("network_component", "component"),
    )
    source_severity: Severity | None = None
    computed_severity: Severity | None = None
    severity_rule: NonEmptyStr | None = None
    latency_ms: float | None = Field(default=None, ge=0)
    throughput_mbps: float | None = Field(default=None, ge=0)
    utilization_pct: float | None = Field(default=None, ge=0, le=100)
    dropped_call_rate_pct: float | None = Field(
        default=None,
        ge=0,
        le=100,
        validation_alias=AliasChoices("dropped_call_rate_pct", "dropped_call_rate"),
    )

    @property
    def alarm_type(self) -> str:
        return self.alarm_code


class NetworkAlarmCreate(BaseModel):
    """POST /alarms body. ``alarm_id`` is optional; the mock OSS assigns the next ID."""

    model_config = MODEL_CONFIG

    alarm_id: NonEmptyStr | None = None
    source_event_id: NonEmptyStr | None = None
    site_id: SiteId
    alarm_code: NonEmptyStr = Field(
        validation_alias=AliasChoices("alarm_code", "alarm_type"),
    )
    severity: Severity
    status: AlarmStatus
    timestamp: UtcDateTime
    message: NonEmptyStr = Field(validation_alias=AliasChoices("message", "description"))
    region: NonEmptyStr | None = None
    source: NonEmptyStr | None = None
    scenario_id: NonEmptyStr | None = None
    correlation_key: NonEmptyStr | None = None
    synthetic: bool = True
    site_name: NonEmptyStr | None = None
    technology: NonEmptyStr | None = None
    vendor: NonEmptyStr | None = None
    network_component: NonEmptyStr | None = Field(
        default=None,
        validation_alias=AliasChoices("network_component", "component"),
    )
    latency_ms: float | None = Field(default=None, ge=0)
    throughput_mbps: float | None = Field(default=None, ge=0)
    utilization_pct: float | None = Field(default=None, ge=0, le=100)
    dropped_call_rate_pct: float | None = Field(
        default=None,
        ge=0,
        le=100,
        validation_alias=AliasChoices("dropped_call_rate_pct", "dropped_call_rate"),
    )


class AlarmListResponse(BaseModel):
    """Paginated GET /alarms payload compatible with the frontend list contract."""

    model_config = MODEL_CONFIG

    items: list[NetworkAlarm]
    total: int = Field(ge=0)
    page: int = Field(ge=1)
    page_size: int = Field(ge=1)
    as_of: UtcDateTime

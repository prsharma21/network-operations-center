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

    @property
    def alarm_type(self) -> str:
        return self.alarm_code

"""Pydantic models for deterministic alarm correlation."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

MODEL = ConfigDict(extra="ignore", str_strip_whitespace=True)


class AlarmEvent(BaseModel):
    """Normalized alarm row used by the correlation engine."""

    model_config = MODEL

    alarm_id: str
    site_id: str
    alarm_code: str
    severity: str
    status: str
    timestamp: datetime
    message: str = ""
    region: str | None = None
    scenario_id: str | None = None
    correlation_key: str | None = None
    network_component: str | None = None
    technology: str | None = None
    site_name: str | None = None


class ExistingIncident(BaseModel):
    """Open/known incident used for duplicate detection."""

    model_config = MODEL

    incident_id: str
    site_id: str
    status: str = "OPEN"
    scenario_id: str | None = None
    evidence_alarm_ids: list[str] = Field(default_factory=list)
    correlation_fingerprint: str | None = None


class CorrelatedIncident(BaseModel):
    """Deterministic correlated incident candidate (no LLM)."""

    model_config = MODEL

    incident_id: str
    site_id: str
    site_name: str | None = None
    region: str | None = None
    title: str
    description: str
    severity: str
    priority: Literal["P1", "P2", "P3", "P4"]
    status: str = "OPEN"
    scenario_id: str | None = None
    scenario_name: str | None = None
    component: str
    evidence_alarm_ids: list[str]
    alarm_codes: list[str]
    correlation_key: str | None = None
    correlation_fingerprint: str
    window_start: datetime
    window_end: datetime
    expected_cause: str | None = None
    duplicate_of: str | None = None
    is_duplicate: bool = False
    synthetic: bool = True


class CorrelationResult(BaseModel):
    """Output of one correlation run."""

    model_config = MODEL

    incidents: list[CorrelatedIncident]
    groups_evaluated: int
    created_count: int
    duplicate_count: int
    skipped_cleared_count: int = 0

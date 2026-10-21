"""Incident schemas.

The synthetic dataset stores *evaluation* incidents in
``data/ground_truth/expected_incidents.json``. Those records are labels for
tests (expected cause, evidence alarm IDs). They are not verified root-cause
analysis and they do not include operational lifecycle fields.

Day 3 also defines an operational ``Incident`` used by the API, with lifecycle
``OPEN``, ``INVESTIGATING``, ``AWAITING_APPROVAL``, ``CLOSED``.
"""

from __future__ import annotations

from pydantic import BaseModel, Field, model_validator

from app.schemas.common import MODEL_CONFIG, NonEmptyStr, SiteId, UtcDateTime
from app.schemas.enums import IncidentLifecycleStatus, Severity, TicketPriority


class GroundTruthIncident(BaseModel):
    """Evaluation label from the synthetic ground-truth file. Not verified RCA."""

    model_config = MODEL_CONFIG

    incident_id: NonEmptyStr
    scenario_id: NonEmptyStr
    site_id: SiteId
    expected_cause: NonEmptyStr = Field(
        description="Synthetic evaluation label only. Not a verified root cause.",
    )
    evidence_alarm_ids: list[NonEmptyStr] = Field(min_length=1)
    expected_signals: list[NonEmptyStr] = Field(default_factory=list)
    deployment_id: NonEmptyStr | None = None


class IncidentCreate(BaseModel):
    """Request body for an operational incident (no persistence in Day 3)."""

    model_config = MODEL_CONFIG

    title: NonEmptyStr
    severity: Severity
    status: IncidentLifecycleStatus = IncidentLifecycleStatus.OPEN
    affected_sites: list[SiteId] = Field(default_factory=list, min_length=0)
    site_id: SiteId | None = None
    scenario_id: NonEmptyStr | None = None
    priority: TicketPriority | None = None
    evidence_alarm_ids: list[NonEmptyStr] = Field(default_factory=list)

    @model_validator(mode="after")
    def require_affected_sites(self) -> IncidentCreate:
        sites = list(self.affected_sites)
        if self.site_id and self.site_id not in sites:
            sites.append(self.site_id)
        if not sites:
            raise ValueError("affected_sites must contain at least one site_id")
        self.affected_sites = sites
        return self


class Incident(IncidentCreate):
    """Operational incident response."""

    incident_id: NonEmptyStr
    created_at: UtcDateTime
    updated_at: UtcDateTime

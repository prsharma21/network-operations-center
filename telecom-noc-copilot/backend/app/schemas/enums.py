"""Shared enumerations.

Event status (alarms, deployments, tickets) is separate from incident lifecycle
status. Severity is lowercase to match the synthetic dataset and frontend.
Incident lifecycle values are uppercase as specified for Day 3.
"""

from __future__ import annotations

from enum import StrEnum


def _match_enum(cls: type[StrEnum], value: object) -> StrEnum | None:
    if not isinstance(value, str):
        return None
    normalized = value.strip().lower().replace("-", "_").replace(" ", "_")
    for member in cls:
        if member.value.lower().replace("-", "_") == normalized:
            return member
        if member.name.lower() == normalized:
            return member
    return None


class Severity(StrEnum):
    """Alarm / incident severity. Matches synthetic data and the frontend."""

    CRITICAL = "critical"
    MAJOR = "major"
    MINOR = "minor"
    WARNING = "warning"
    INFO = "info"
    CLEARED = "cleared"

    @classmethod
    def _missing_(cls, value: object) -> Severity | None:
        return _match_enum(cls, value)  # type: ignore[return-value]


class SiteStatus(StrEnum):
    """Operational state of a cell site in the synthetic inventory."""

    UP = "up"
    DOWN = "down"
    DEGRADED = "degraded"
    MAINTENANCE = "maintenance"

    @classmethod
    def _missing_(cls, value: object) -> SiteStatus | None:
        return _match_enum(cls, value)  # type: ignore[return-value]


class AlarmStatus(StrEnum):
    """Network alarm event status (not incident lifecycle)."""

    ACTIVE = "active"
    ACKNOWLEDGED = "acknowledged"
    CLEARED = "cleared"

    @classmethod
    def _missing_(cls, value: object) -> AlarmStatus | None:
        return _match_enum(cls, value)  # type: ignore[return-value]


class TelemetryState(StrEnum):
    NORMAL = "normal"
    ABNORMAL = "abnormal"

    @classmethod
    def _missing_(cls, value: object) -> TelemetryState | None:
        return _match_enum(cls, value)  # type: ignore[return-value]


class DeploymentStatus(StrEnum):
    """Change / deployment event status."""

    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    COMPLETED_WITH_WARNING = "completed_with_warning"
    FAILED = "failed"
    ROLLED_BACK = "rolled_back"

    @classmethod
    def _missing_(cls, value: object) -> DeploymentStatus | None:
        return _match_enum(cls, value)  # type: ignore[return-value]


class DeploymentChangeType(StrEnum):
    SOFTWARE = "software"
    CONFIGURATION = "configuration"

    @classmethod
    def _missing_(cls, value: object) -> DeploymentChangeType | None:
        return _match_enum(cls, value)  # type: ignore[return-value]


class TicketStatus(StrEnum):
    """Ticketing-system status (not incident lifecycle)."""

    OPEN = "open"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    CLOSED = "closed"

    @classmethod
    def _missing_(cls, value: object) -> TicketStatus | None:
        return _match_enum(cls, value)  # type: ignore[return-value]


class TicketPriority(StrEnum):
    P1 = "P1"
    P2 = "P2"
    P3 = "P3"
    P4 = "P4"

    @classmethod
    def _missing_(cls, value: object) -> TicketPriority | None:
        if not isinstance(value, str):
            return None
        normalized = value.strip().upper()
        for member in cls:
            if member.value == normalized:
                return member
        return None


class IncidentLifecycleStatus(StrEnum):
    """Incident workflow. Distinct from alarm, deployment, and ticket status."""

    OPEN = "OPEN"
    INVESTIGATING = "INVESTIGATING"
    AWAITING_APPROVAL = "AWAITING_APPROVAL"
    CLOSED = "CLOSED"

    @classmethod
    def _missing_(cls, value: object) -> IncidentLifecycleStatus | None:
        if not isinstance(value, str):
            return None
        normalized = value.strip().upper().replace("-", "_").replace(" ", "_")
        for member in cls:
            if member.value == normalized or member.name == normalized:
                return member
        return None

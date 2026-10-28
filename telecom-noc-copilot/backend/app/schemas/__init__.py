"""Pydantic request/response schemas for Day 3."""

from app.schemas.alarm import AlarmListResponse, NetworkAlarm, NetworkAlarmCreate
from app.schemas.deployment import DeploymentEvent, DeploymentListResponse
from app.schemas.enums import (
    AlarmStatus,
    DeploymentStatus,
    IncidentLifecycleStatus,
    Severity,
    SiteStatus,
    TicketPriority,
    TicketStatus,
)
from app.schemas.incident import GroundTruthIncident, Incident, IncidentCreate, IncidentListResponse
from app.schemas.site import NetworkSite, SiteEquipment, SiteListResponse, TopologyReference
from app.schemas.telemetry import TelemetryListResponse, TelemetryMetric, TelemetryMetricCreate
from app.schemas.ticket import Ticket, TicketListResponse

__all__ = [
    "AlarmListResponse",
    "AlarmStatus",
    "DeploymentEvent",
    "DeploymentListResponse",
    "DeploymentStatus",
    "GroundTruthIncident",
    "Incident",
    "IncidentCreate",
    "IncidentListResponse",
    "IncidentLifecycleStatus",
    "NetworkAlarm",
    "NetworkAlarmCreate",
    "NetworkSite",
    "SiteListResponse",
    "Severity",
    "SiteEquipment",
    "TopologyReference",
    "SiteStatus",
    "TelemetryListResponse",
    "TelemetryMetric",
    "TelemetryMetricCreate",
    "Ticket",
    "TicketListResponse",
    "TicketPriority",
    "TicketStatus",
]

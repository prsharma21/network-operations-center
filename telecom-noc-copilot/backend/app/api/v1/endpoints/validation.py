"""Schema validation echo endpoints.

These routes exist so Swagger documents the Day 3 Pydantic models. They
validate the request body and return it. They do not persist data or perform
network actions. Full CRUD is a later step.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.schemas import (
    DeploymentEvent,
    Incident,
    IncidentCreate,
    NetworkAlarm,
    NetworkSite,
    TelemetryMetric,
    Ticket,
)

router = APIRouter(prefix="/validate", tags=["validation"])


@router.post("/sites", response_model=NetworkSite)
def validate_site(payload: NetworkSite) -> NetworkSite:
    return payload


@router.post("/alarms", response_model=NetworkAlarm)
def validate_alarm(payload: NetworkAlarm) -> NetworkAlarm:
    return payload


@router.post("/telemetry", response_model=TelemetryMetric)
def validate_telemetry(payload: TelemetryMetric) -> TelemetryMetric:
    return payload


@router.post("/deployments", response_model=DeploymentEvent)
def validate_deployment(payload: DeploymentEvent) -> DeploymentEvent:
    return payload


@router.post("/incidents", response_model=IncidentCreate)
def validate_incident_create(payload: IncidentCreate) -> IncidentCreate:
    return payload


@router.post("/incidents/full", response_model=Incident)
def validate_incident(payload: Incident) -> Incident:
    return payload


@router.post("/tickets", response_model=Ticket)
def validate_ticket(payload: Ticket) -> Ticket:
    return payload

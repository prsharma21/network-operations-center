"""Incident listing on top of JSON or SQLAlchemy OSS repositories."""

from __future__ import annotations

from datetime import UTC, datetime

from pydantic import ValidationError

from app.schemas.enums import IncidentLifecycleStatus
from app.schemas.incident import Incident, IncidentListResponse
from oss_api.exceptions import IncidentNotFound
from oss_api.repository import OssDataRepository


class OssIncidentService:
    def __init__(self, repository: OssDataRepository) -> None:
        self._repository = repository

    def list_incidents(
        self,
        *,
        site_id: str | None = None,
        status: IncidentLifecycleStatus | None = None,
        page: int = 1,
        page_size: int = 25,
    ) -> IncidentListResponse:
        incidents = self._validated()
        if site_id and site_id.strip():
            wanted = site_id.strip()
            incidents = [item for item in incidents if item.site_id == wanted]
        if status is not None:
            incidents = [item for item in incidents if item.status is status]
        incidents.sort(key=lambda item: (item.created_at, item.incident_id), reverse=True)
        total = len(incidents)
        start = (page - 1) * page_size
        page_items = incidents[start : start + page_size]
        as_of = incidents[0].created_at if incidents else datetime.now(UTC)
        return IncidentListResponse(
            items=page_items,
            total=total,
            page=page,
            page_size=page_size,
            as_of=as_of,
        )

    def get_incident(self, incident_id: str) -> Incident:
        requested = incident_id.strip()
        if not requested:
            raise IncidentNotFound(incident_id)
        record = self._repository.get_incident_record(requested)
        if record is None:
            raise IncidentNotFound(requested)
        try:
            return Incident.model_validate(_incident_payload(record))
        except ValidationError as exc:
            raise IncidentNotFound(requested) from exc

    def _validated(self) -> list[Incident]:
        parsed: list[Incident] = []
        for row in self._repository.list_incident_records():
            try:
                parsed.append(Incident.model_validate(_incident_payload(row)))
            except ValidationError:
                continue
        return parsed


_INCIDENT_FIELDS = set(Incident.model_fields)


def _incident_payload(row: dict) -> dict:
    return {key: value for key, value in row.items() if key in _INCIDENT_FIELDS}

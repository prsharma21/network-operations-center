"""Assemble a validated site configuration from the OSS repository."""

from __future__ import annotations

from pydantic import ValidationError

from app.schemas.site import NetworkSite
from oss_api.exceptions import InvalidStoredSite, SiteNotFound
from oss_api.repository import SiteRepository


class OssSiteService:
    def __init__(self, repository: SiteRepository) -> None:
        self._repository = repository

    def get_site(self, site_id: str) -> NetworkSite:
        requested = site_id.strip()
        if not requested:
            raise SiteNotFound(site_id)

        record = self._repository.get_site_record(requested)
        if record is None:
            raise SiteNotFound(requested)

        payload = {
            **record,
            "equipment": self._repository.list_equipment(requested),
            "topology": self._repository.list_topology(requested),
        }
        try:
            return NetworkSite.model_validate(payload)
        except ValidationError as exc:
            raise InvalidStoredSite(requested, exc.errors()[0]["msg"]) from exc

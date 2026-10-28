"""Assemble a validated site configuration from the OSS repository."""

from __future__ import annotations

from pydantic import ValidationError

from app.schemas.site import NetworkSite
from oss_api.exceptions import InvalidStoredSite, SiteNotFound
from oss_api.repository import SiteRepository


class OssSiteService:
    def __init__(self, repository: SiteRepository) -> None:
        self._repository = repository

    def list_sites(self) -> list[NetworkSite]:
        list_records = getattr(self._repository, "list_site_records", None)
        if not callable(list_records):
            return []
        parsed: list[NetworkSite] = []
        for row in list_records():
            site_id = str(row.get("site_id") or "").strip()
            if not site_id:
                continue
            payload = {
                **row,
                "equipment": self._repository.list_equipment(site_id),
                "topology": self._repository.list_topology(site_id),
            }
            try:
                parsed.append(NetworkSite.model_validate(payload))
            except ValidationError:
                continue
        parsed.sort(key=lambda item: item.site_id)
        return parsed

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

"""Read-only synthetic network topology listing."""

from __future__ import annotations

from datetime import UTC, datetime

from pydantic import ValidationError

from app.schemas.site import TopologyReference
from app.schemas.topology import TopologyListResponse, TopologyNode
from oss_api.exceptions import SiteNotFound
from oss_api.repository import OssDataRepository


class OssTopologyService:
    def __init__(self, repository: OssDataRepository) -> None:
        self._repository = repository

    def list_topology(
        self,
        *,
        site_id: str | None = None,
        region: str | None = None,
        page: int = 1,
        page_size: int = 100,
    ) -> TopologyListResponse:
        if site_id and site_id.strip():
            wanted = site_id.strip()
            if self._repository.get_site_record(wanted) is None:
                raise SiteNotFound(wanted)
            site_ids = [wanted]
        else:
            site_ids = [
                str(row.get("site_id") or "").strip()
                for row in self._repository.list_site_records()
                if str(row.get("site_id") or "").strip()
            ]
            if region and region.strip():
                wanted_region = region.strip().casefold()
                site_ids = [
                    sid
                    for sid in site_ids
                    if self._site_region(sid).casefold() == wanted_region
                ]

        links_by_id: dict[str, TopologyReference] = {}
        for sid in site_ids:
            for row in self._repository.list_topology(sid):
                try:
                    link = TopologyReference.model_validate(row)
                except ValidationError:
                    continue
                links_by_id[link.link_id] = link

        links = sorted(links_by_id.values(), key=lambda item: item.link_id)
        total = len(links)
        start = (page - 1) * page_size
        page_items = links[start : start + page_size]
        nodes = self._nodes_for(page_items)
        return TopologyListResponse(
            items=page_items,
            nodes=nodes,
            total=total,
            page=page,
            page_size=page_size,
            as_of=datetime.now(UTC),
        )

    def _site_region(self, site_id: str) -> str:
        site = self._repository.get_site_record(site_id)
        region = site.get("region") if site else None
        return region.strip() if isinstance(region, str) else ""

    def _nodes_for(self, links: list[TopologyReference]) -> list[TopologyNode]:
        node_ids: set[str] = set()
        for link in links:
            node_ids.add(link.source_id)
            node_ids.add(link.target_id)

        nodes: list[TopologyNode] = []
        for node_id in sorted(node_ids):
            if node_id.startswith("SITE-"):
                site = self._repository.get_site_record(node_id)
                nodes.append(
                    TopologyNode(
                        node_id=node_id,
                        node_kind="site",
                        site_id=node_id,
                        site_name=(site or {}).get("site_name"),
                        region=(site or {}).get("region"),
                    )
                )
            elif node_id.startswith("AGG-"):
                nodes.append(TopologyNode(node_id=node_id, node_kind="aggregation"))
            else:
                nodes.append(TopologyNode(node_id=node_id, node_kind="other"))
        return nodes

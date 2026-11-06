from __future__ import annotations

from fastapi.testclient import TestClient

from app.schemas.topology import TopologyListResponse


def test_get_topology_returns_links_and_nodes(client: TestClient) -> None:
    response = client.get("/topology")
    assert response.status_code == 200
    body = TopologyListResponse.model_validate(response.json())
    assert body.total >= 1
    assert len(body.items) == body.total or len(body.items) == body.page_size
    assert body.nodes
    assert any(node.node_kind == "site" for node in body.nodes)


def test_get_topology_filter_site_id(client: TestClient) -> None:
    response = client.get("/topology", params={"site_id": "SITE-003"})
    assert response.status_code == 200
    body = response.json()
    assert body["total"] >= 1
    for link in body["items"]:
        assert "SITE-003" in {link["source_id"], link["target_id"]}


def test_get_topology_unknown_site_404(client: TestClient) -> None:
    response = client.get("/topology", params={"site_id": "SITE-999"})
    assert response.status_code == 404


def test_get_topology_filter_region(client: TestClient) -> None:
    response = client.get("/topology", params={"region": "North"})
    assert response.status_code == 200
    body = response.json()
    assert body["total"] >= 1
    site_nodes = [node for node in body["nodes"] if node.get("node_kind") == "site"]
    assert site_nodes
    assert all((node.get("region") or "").casefold() == "north" for node in site_nodes)

from __future__ import annotations

from datetime import UTC, datetime

from fastapi.testclient import TestClient

from app.schemas.deployment import DeploymentEvent
from app.utils.timestamps import parse_utc_datetime

DEPLOYMENT_COUNT = 6


def test_get_deployments_returns_newest_first(client: TestClient) -> None:
    response = client.get("/deployments")
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == DEPLOYMENT_COUNT
    assert body["page"] == 1
    assert body["page_size"] == 25
    assert len(body["items"]) == DEPLOYMENT_COUNT
    items = [DeploymentEvent.model_validate(item) for item in body["items"]]
    assert [item.deployment_id for item in items] == [
        "DEP-006",
        "DEP-005",
        "DEP-004",
        "DEP-003",
        "DEP-002",
        "DEP-001",
    ]
    assert items[0].site_id == "SITE-002"
    assert items[-1].version_after == "R21.1"
    assert items[-1].notes.startswith("Synthetic configuration rollout")


def test_get_deployments_filter_site_id(client: TestClient) -> None:
    response = client.get("/deployments", params={"site_id": "SITE-012"})
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["deployment_id"] == "DEP-001"
    assert body["items"][0]["site_id"] == "SITE-012"


def test_get_deployments_filter_region(client: TestClient) -> None:
    response = client.get("/deployments", params={"region": "South"})
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 2
    assert {item["deployment_id"] for item in body["items"]} == {"DEP-001", "DEP-006"}


def test_get_deployments_filter_status(client: TestClient) -> None:
    response = client.get("/deployments", params={"status": "completed_with_warning"})
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["deployment_id"] == "DEP-001"
    assert body["items"][0]["status"] == "completed_with_warning"


def test_get_deployments_filter_time_range(client: TestClient) -> None:
    response = client.get(
        "/deployments",
        params={
            "start_time": "2026-10-19T08:00:00+00:00",
            "end_time": "2026-10-19T16:00:00+00:00",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 3
    assert [item["deployment_id"] for item in body["items"]] == [
        "DEP-004",
        "DEP-003",
        "DEP-002",
    ]


def test_get_deployments_normalizes_filter_timestamps(client: TestClient) -> None:
    response = client.get(
        "/deployments",
        params={
            "start_time": "2026-10-19T13:30:00+05:30",
            "end_time": "2026-10-19T21:30:00+05:30",
        },
    )
    assert response.status_code == 200
    assert [item["deployment_id"] for item in response.json()["items"]] == [
        "DEP-004",
        "DEP-003",
        "DEP-002",
    ]
    first = parse_utc_datetime(response.json()["items"][0]["timestamp"])
    assert first == datetime(2026, 10, 19, 16, 0, tzinfo=UTC)


def test_get_deployments_combined_filters(client: TestClient) -> None:
    response = client.get(
        "/deployments",
        params={"region": "South", "status": "completed"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["deployment_id"] == "DEP-006"


def test_get_deployments_empty_results(client: TestClient) -> None:
    response = client.get("/deployments", params={"site_id": "SITE-DOES-NOT-EXIST"})
    assert response.status_code == 200
    body = response.json()
    assert body["items"] == []
    assert body["total"] == 0


def test_get_deployments_rejects_invalid_query_values(client: TestClient) -> None:
    assert client.get("/deployments", params={"status": "active"}).status_code == 422
    assert client.get("/deployments", params={"page": 0}).status_code == 422
    assert client.get("/deployments", params={"page_size": 101}).status_code == 422


def test_get_deployments_rejects_invalid_time_range(client: TestClient) -> None:
    inverted = client.get(
        "/deployments",
        params={
            "start_time": "2026-10-19T16:00:00+00:00",
            "end_time": "2026-10-19T08:00:00+00:00",
        },
    )
    assert inverted.status_code == 422
    naive = client.get("/deployments", params={"start_time": "2026-10-19T08:00:00"})
    assert naive.status_code == 422


def test_get_deployments_pagination(client: TestClient) -> None:
    first = client.get("/deployments", params={"page": 1, "page_size": 2})
    assert first.status_code == 200
    first_body = first.json()
    assert first_body["total"] == DEPLOYMENT_COUNT
    assert first_body["page"] == 1
    assert first_body["page_size"] == 2
    assert [item["deployment_id"] for item in first_body["items"]] == ["DEP-006", "DEP-005"]

    last = client.get("/deployments", params={"page": 3, "page_size": 2})
    assert last.status_code == 200
    assert [item["deployment_id"] for item in last.json()["items"]] == ["DEP-002", "DEP-001"]

    beyond = client.get("/deployments", params={"page": 4, "page_size": 2})
    assert beyond.status_code == 200
    assert beyond.json()["items"] == []
    assert beyond.json()["total"] == DEPLOYMENT_COUNT

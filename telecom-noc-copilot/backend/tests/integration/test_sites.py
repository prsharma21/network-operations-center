from __future__ import annotations

from fastapi.testclient import TestClient

from app.api.deps import get_oss_service
from app.main import app
from app.schemas.site import NetworkSite
from oss_api.service import OssSiteService


class BrokenRepository:
    def get_site_record(self, site_id: str) -> dict | None:
        return {"site_id": site_id}

    def list_equipment(self, site_id: str) -> list[dict]:
        return []

    def list_topology(self, site_id: str) -> list[dict]:
        return []


def test_existing_site_returns_200(client: TestClient) -> None:
    response = client.get("/sites/SITE-003")
    assert response.status_code == 200
    body = response.json()
    site = NetworkSite.model_validate(body)
    assert site.site_id == "SITE-003"
    assert site.site_name == "East-CELL-003"
    assert site.region == "East"
    assert site.technology == "4G+5G"
    assert site.vendor == "Nokia"
    assert site.status.value == "degraded"
    assert {item.component for item in site.equipment} >= {
        "radio_unit",
        "baseband_unit",
        "backhaul_router",
    }
    assert site.topology
    assert all(
        item.source_id == "SITE-003" or item.target_id == "SITE-003" for item in site.topology
    )


def test_unknown_site_returns_404(client: TestClient) -> None:
    response = client.get("/sites/SITE-DOES-NOT-EXIST")
    assert response.status_code == 404
    assert "SITE-DOES-NOT-EXIST" in response.json()["detail"]
    assert "SITE-001" not in response.json()["detail"]


def test_invalid_stored_site_returns_500(client: TestClient) -> None:
    get_oss_service.cache_clear()
    app.dependency_overrides[get_oss_service] = lambda: OssSiteService(BrokenRepository())
    try:
        response = client.get("/sites/SITE-003")
        assert response.status_code == 500
        assert "SITE-003" in response.json()["detail"]
    finally:
        app.dependency_overrides.clear()
        get_oss_service.cache_clear()


def test_health_still_works(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_validation_route_still_works(client: TestClient) -> None:
    response = client.post(
        "/api/v1/validate/sites",
        json={
            "site_id": "SITE-001",
            "site_name": "North-CELL-001",
            "region": "North",
            "technology": "4G",
            "vendor": "Ericsson",
            "status": "up",
            "latitude": 29.7424,
            "longitude": 80.94181,
        },
    )
    assert response.status_code == 200
    assert response.json()["site_id"] == "SITE-001"

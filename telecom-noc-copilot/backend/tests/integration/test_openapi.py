from __future__ import annotations

from fastapi.testclient import TestClient


def test_docs_ui_is_available(client: TestClient) -> None:
    response = client.get("/docs")
    assert response.status_code == 200
    assert "swagger" in response.text.lower() or "Swagger" in response.text


def test_openapi_includes_health_and_entity_schemas(client: TestClient) -> None:
    response = client.get("/openapi.json")
    assert response.status_code == 200
    spec = response.json()
    assert spec["info"]["title"]
    paths = spec["paths"]
    assert "/health" in paths
    assert "/api/v1/validate/sites" in paths
    assert "/api/v1/validate/alarms" in paths
    assert "/api/v1/validate/telemetry" in paths
    assert "/api/v1/validate/deployments" in paths
    assert "/api/v1/validate/incidents" in paths
    assert "/api/v1/validate/tickets" in paths

    schemas = spec["components"]["schemas"]
    for name in (
        "NetworkSite",
        "NetworkAlarm",
        "TelemetryMetric",
        "DeploymentEvent",
        "Incident",
        "Ticket",
        "HealthResponse",
    ):
        assert name in schemas, f"missing OpenAPI schema {name}"

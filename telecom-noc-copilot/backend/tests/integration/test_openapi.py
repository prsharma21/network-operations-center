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
    assert "/sites/{site_id}" in paths
    assert "/alarms" in paths
    assert "get" in paths["/alarms"]
    assert "post" in paths["/alarms"]
    alarm_get_params = {item["name"] for item in paths["/alarms"]["get"]["parameters"]}
    assert alarm_get_params >= {"site_id", "severity", "region", "status", "page", "page_size"}
    assert paths["/alarms"]["post"]["responses"]["201"]
    assert paths["/alarms"]["post"]["responses"]["409"]
    assert "/telemetry" in paths
    assert "post" in paths["/telemetry"]
    assert "/sites/{site_id}/metrics" in paths
    assert "get" in paths["/sites/{site_id}/metrics"]
    metric_get_params = {
        item["name"] for item in paths["/sites/{site_id}/metrics"]["get"]["parameters"]
    }
    assert metric_get_params >= {"site_id", "start_time", "end_time", "page", "page_size"}
    assert paths["/telemetry"]["post"]["responses"]["201"]
    assert paths["/telemetry"]["post"]["responses"]["404"]
    assert "/deployments" in paths
    assert "get" in paths["/deployments"]
    assert "post" not in paths["/deployments"]
    deployment_params = {item["name"] for item in paths["/deployments"]["get"]["parameters"]}
    assert deployment_params >= {
        "site_id",
        "region",
        "status",
        "start_time",
        "end_time",
        "page",
        "page_size",
    }
    assert "/tickets" in paths
    assert "get" in paths["/tickets"]
    assert "post" not in paths["/tickets"]
    ticket_params = {item["name"] for item in paths["/tickets"]["get"]["parameters"]}
    assert ticket_params >= {"incident_id", "status", "priority", "owner", "page", "page_size"}
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
        "NetworkAlarmCreate",
        "AlarmListResponse",
        "TelemetryMetric",
        "TelemetryMetricCreate",
        "TelemetryListResponse",
        "DeploymentEvent",
        "DeploymentListResponse",
        "Incident",
        "Ticket",
        "TicketListResponse",
        "HealthResponse",
    ):
        assert name in schemas, f"missing OpenAPI schema {name}"

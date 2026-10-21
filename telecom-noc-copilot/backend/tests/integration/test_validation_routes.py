from __future__ import annotations

from fastapi.testclient import TestClient


def test_validate_site_rejects_blank_name(client: TestClient) -> None:
    response = client.post(
        "/api/v1/validate/sites",
        json={
            "site_id": "SITE-001",
            "site_name": "  ",
            "region": "North",
            "technology": "4G",
            "vendor": "Ericsson",
            "status": "up",
            "latitude": 29.7,
            "longitude": 80.9,
        },
    )
    assert response.status_code == 422


def test_validate_incident_accepts_lifecycle_status(client: TestClient) -> None:
    response = client.post(
        "/api/v1/validate/incidents",
        json={
            "title": "Awaiting rollback approval",
            "severity": "major",
            "status": "AWAITING_APPROVAL",
            "affected_sites": ["SITE-012"],
        },
    )
    assert response.status_code == 200
    assert response.json()["status"] == "AWAITING_APPROVAL"


def test_validate_telemetry_rejects_negative_latency(client: TestClient) -> None:
    response = client.post(
        "/api/v1/validate/telemetry",
        json={
            "metric_id": "MET-X",
            "timestamp": "2026-10-19T00:00:00+00:00",
            "site_id": "SITE-001",
            "latency_ms": -5,
            "throughput_mbps": 10,
            "utilization_pct": 10,
            "dropped_call_rate_pct": 1,
        },
    )
    assert response.status_code == 422

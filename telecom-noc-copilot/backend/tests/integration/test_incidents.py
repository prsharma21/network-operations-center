from __future__ import annotations

from fastapi.testclient import TestClient

from app.schemas.incident import Incident


def test_list_incidents_returns_ground_truth_rows(client: TestClient) -> None:
    response = client.get("/incidents")
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 3
    ids = {item["incident_id"] for item in body["items"]}
    assert ids == {"INC-OUTAGE-001", "INC-CONGESTION-001", "INC-DEPLOY-001"}
    for item in body["items"]:
        Incident.model_validate(item)
        assert item["evidence_alarm_ids"]


def test_get_incident_includes_associated_alarms(client: TestClient) -> None:
    response = client.get("/incidents/INC-OUTAGE-001")
    assert response.status_code == 200
    incident = Incident.model_validate(response.json())
    assert incident.site_id == "SITE-003"
    assert "ALM-0001" in incident.evidence_alarm_ids


def test_unknown_incident_returns_404(client: TestClient) -> None:
    response = client.get("/incidents/INC-DOES-NOT-EXIST")
    assert response.status_code == 404

from __future__ import annotations

from fastapi.testclient import TestClient


def test_investigate_unknown_incident_returns_404(client: TestClient) -> None:
    response = client.post("/incidents/INC-DOES-NOT-EXIST/investigate")
    assert response.status_code == 404


def test_report_before_investigation_returns_404(client: TestClient) -> None:
    response = client.get("/incidents/INC-NO-REPORT/report")
    assert response.status_code == 404


def test_investigate_outage_returns_ranked_causes_and_report(client: TestClient) -> None:
    response = client.post("/incidents/INC-OUTAGE-001/investigate")
    assert response.status_code == 200
    body = response.json()
    assert body["incidentId"] == "INC-OUTAGE-001"
    assert body["investigationStatus"] == "completed"
    assert body["correlatedAlarms"]
    assert len(body["candidates"]) == 2
    assert "backhaul" in body["candidates"][0]["hypothesis"].lower()
    assert body["candidates"][1]["contradictory"]
    assert body["runbookRetrieval"] == "retrieved"
    assert body["runbookPassages"][0]["technology"]
    assert body["evidence"]
    assert body["nextSteps"]
    assert body["recommendation"] is None
    assert "not proof" in body["causationNote"]

    report = client.get("/incidents/INC-OUTAGE-001/report")
    assert report.status_code == 200
    payload = report.json()
    assert payload["reportId"] == body["reportId"]
    assert payload["incidentId"] == "INC-OUTAGE-001"
    assert payload["summary"]
    assert payload["actionStatus"] == "not_executed"
    assert payload["candidates"][0]["supporting"]

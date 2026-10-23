from __future__ import annotations

from fastapi.testclient import TestClient

from app.schemas.ticket import Ticket

TICKET_COUNT = 15


def test_get_tickets_returns_newest_first(client: TestClient) -> None:
    response = client.get("/tickets")
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == TICKET_COUNT
    assert body["page"] == 1
    assert body["page_size"] == 25
    assert len(body["items"]) == TICKET_COUNT
    tickets = [Ticket.model_validate(item) for item in body["items"]]
    assert tickets[0].ticket_id == "TKT-0008"
    assert tickets[-1].ticket_id == "TKT-0001"
    assert tickets[-1].assigned_group == "NOC-L2"
    assert tickets[-1].description.startswith("Synthetic training ticket")
    assert tickets[-1].incident_id is None
    timestamps = [item.created_at for item in tickets]
    assert timestamps == sorted(timestamps, reverse=True)


def test_get_tickets_filter_status(client: TestClient) -> None:
    response = client.get("/tickets", params={"status": "resolved"})
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 3
    assert {item["status"] for item in body["items"]} == {"resolved"}
    assert {item["ticket_id"] for item in body["items"]} == {
        "TKT-0008",
        "TKT-0012",
        "TKT-0015",
    }


def test_get_tickets_filter_priority(client: TestClient) -> None:
    response = client.get("/tickets", params={"priority": "P1"})
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["ticket_id"] == "TKT-0001"
    assert body["items"][0]["priority"] == "P1"


def test_get_tickets_filter_owner(client: TestClient) -> None:
    response = client.get("/tickets", params={"owner": "NOC-L1"})
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 3
    assert {item["assigned_group"] for item in body["items"]} == {"NOC-L1"}
    assert {item["ticket_id"] for item in body["items"]} == {
        "TKT-0006",
        "TKT-0012",
        "TKT-0014",
    }


def test_get_tickets_filter_incident_id_returns_empty_when_unset(client: TestClient) -> None:
    response = client.get("/tickets", params={"incident_id": "INC-OUTAGE-001"})
    assert response.status_code == 200
    body = response.json()
    assert body["items"] == []
    assert body["total"] == 0


def test_get_tickets_combined_filters(client: TestClient) -> None:
    response = client.get(
        "/tickets",
        params={"status": "open", "priority": "P2", "owner": "NOC-L2"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 2
    assert {item["ticket_id"] for item in body["items"]} == {"TKT-0003", "TKT-0007"}


def test_get_tickets_empty_results(client: TestClient) -> None:
    response = client.get("/tickets", params={"status": "closed"})
    assert response.status_code == 200
    body = response.json()
    assert body["items"] == []
    assert body["total"] == 0


def test_get_tickets_rejects_invalid_query_values(client: TestClient) -> None:
    assert client.get("/tickets", params={"status": "active"}).status_code == 422
    assert client.get("/tickets", params={"priority": "P5"}).status_code == 422
    assert client.get("/tickets", params={"page": 0}).status_code == 422
    assert client.get("/tickets", params={"page_size": 101}).status_code == 422


def test_get_tickets_pagination(client: TestClient) -> None:
    first = client.get("/tickets", params={"page": 1, "page_size": 5})
    assert first.status_code == 200
    first_body = first.json()
    assert first_body["total"] == TICKET_COUNT
    assert first_body["page"] == 1
    assert first_body["page_size"] == 5
    assert [item["ticket_id"] for item in first_body["items"]] == [
        "TKT-0008",
        "TKT-0009",
        "TKT-0014",
        "TKT-0012",
        "TKT-0004",
    ]

    last = client.get("/tickets", params={"page": 3, "page_size": 5})
    assert last.status_code == 200
    assert len(last.json()["items"]) == 5
    assert last.json()["items"][-1]["ticket_id"] == "TKT-0001"

    beyond = client.get("/tickets", params={"page": 4, "page_size": 5})
    assert beyond.status_code == 200
    assert beyond.json()["items"] == []
    assert beyond.json()["total"] == TICKET_COUNT

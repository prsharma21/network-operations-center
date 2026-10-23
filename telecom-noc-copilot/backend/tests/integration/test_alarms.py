from __future__ import annotations

from datetime import UTC, datetime

from fastapi.testclient import TestClient

from app.schemas.alarm import NetworkAlarm
from app.utils.timestamps import parse_utc_datetime

FIXTURE_ALARM_COUNT = 100


def _new_alarm(**overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "alarm_id": "ALM-0200",
        "site_id": "SITE-001",
        "alarm_code": "SITE_UNREACHABLE",
        "severity": "critical",
        "status": "active",
        "timestamp": "2026-10-21T12:00:00+00:00",
        "message": "Synthetic Phase 2 ingest",
        "source": "synthetic-oss",
    }
    payload.update(overrides)
    return payload


def test_post_alarm_creates_record(client: TestClient) -> None:
    response = client.post("/alarms", json=_new_alarm())
    assert response.status_code == 201
    body = response.json()
    created = NetworkAlarm.model_validate(body)
    assert created.alarm_id == "ALM-0200"
    assert created.site_id == "SITE-001"
    assert created.region == "North"
    assert created.severity.value == "critical"
    assert created.status.value == "active"
    assert response.headers["location"] == "/alarms/ALM-0200"

    listed = client.get("/alarms", params={"site_id": "SITE-001", "page_size": 100})
    assert listed.status_code == 200
    ids = [item["alarm_id"] for item in listed.json()["items"]]
    assert "ALM-0200" in ids


def test_post_alarm_assigns_id_when_omitted(client: TestClient) -> None:
    payload = _new_alarm()
    del payload["alarm_id"]
    response = client.post("/alarms", json=payload)
    assert response.status_code == 201
    assert response.json()["alarm_id"] == "ALM-0101"


def test_post_alarm_rejects_invalid_payload(client: TestClient) -> None:
    response = client.post("/alarms", json={"alarm_id": "ALM-1"})
    assert response.status_code == 422


def test_post_alarm_rejects_blank_required_fields(client: TestClient) -> None:
    response = client.post("/alarms", json=_new_alarm(message="   "))
    assert response.status_code == 422


def test_post_alarm_rejects_invalid_severity(client: TestClient) -> None:
    response = client.post("/alarms", json=_new_alarm(severity="catastrophic"))
    assert response.status_code == 422


def test_post_alarm_rejects_invalid_status(client: TestClient) -> None:
    response = client.post("/alarms", json=_new_alarm(status="OPEN"))
    assert response.status_code == 422


def test_post_alarm_rejects_naive_timestamp(client: TestClient) -> None:
    response = client.post("/alarms", json=_new_alarm(timestamp="2026-10-21T12:00:00"))
    assert response.status_code == 422


def test_post_alarm_normalizes_timestamp_to_utc(client: TestClient) -> None:
    response = client.post(
        "/alarms",
        json=_new_alarm(timestamp="2026-10-21T17:30:00+05:30"),
    )
    assert response.status_code == 201
    parsed = parse_utc_datetime(response.json()["timestamp"])
    assert parsed == datetime(2026, 10, 21, 12, 0, tzinfo=UTC)
    assert parsed.utcoffset().total_seconds() == 0


def test_post_alarm_rejects_unknown_site(client: TestClient) -> None:
    response = client.post("/alarms", json=_new_alarm(site_id="SITE-DOES-NOT-EXIST"))
    assert response.status_code == 404
    detail = response.json()["detail"]
    assert "SITE-DOES-NOT-EXIST" in detail
    assert "SITE-001" not in detail

    listed = client.get("/alarms", params={"page_size": 100})
    assert listed.json()["total"] == FIXTURE_ALARM_COUNT


def test_post_alarm_rejects_duplicate_id(client: TestClient) -> None:
    original = client.get("/alarms", params={"site_id": "SITE-003", "page_size": 100})
    original_ids = {item["alarm_id"]: item["message"] for item in original.json()["items"]}
    assert original_ids["ALM-0001"] == "Backhaul path unreachable"

    response = client.post(
        "/alarms",
        json=_new_alarm(
            alarm_id="ALM-0001",
            site_id="SITE-003",
            message="Must not overwrite the existing alarm",
        ),
    )
    assert response.status_code == 409
    assert "ALM-0001" in response.json()["detail"]

    after = client.get("/alarms", params={"site_id": "SITE-003", "page_size": 100})
    messages = {item["alarm_id"]: item["message"] for item in after.json()["items"]}
    assert messages["ALM-0001"] == "Backhaul path unreachable"
    assert after.json()["total"] == original.json()["total"]


def test_get_alarms_returns_paginated_newest_first(client: TestClient) -> None:
    response = client.get("/alarms", params={"page": 1, "page_size": 10})
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == FIXTURE_ALARM_COUNT
    assert body["page"] == 1
    assert body["page_size"] == 10
    assert len(body["items"]) == 10
    assert "as_of" in body
    timestamps = [parse_utc_datetime(item["timestamp"]) for item in body["items"]]
    ids = [item["alarm_id"] for item in body["items"]]
    assert timestamps == sorted(timestamps, reverse=True)
    for earlier, later, earlier_id, later_id in zip(timestamps, timestamps[1:], ids, ids[1:]):
        if earlier == later:
            assert earlier_id > later_id


def test_get_alarms_filter_site_id(client: TestClient) -> None:
    response = client.get("/alarms", params={"site_id": "SITE-003", "page_size": 100})
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 4
    assert {item["site_id"] for item in body["items"]} == {"SITE-003"}
    assert {item["alarm_id"] for item in body["items"]} == {
        "ALM-0001",
        "ALM-0002",
        "ALM-0003",
        "ALM-0050",
    }


def test_get_alarms_filter_severity(client: TestClient) -> None:
    response = client.get("/alarms", params={"severity": "critical", "page_size": 100})
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 5
    assert {item["severity"] for item in body["items"]} == {"critical"}


def test_get_alarms_filter_region(client: TestClient) -> None:
    response = client.get("/alarms", params={"region": "Central", "page_size": 100})
    assert response.status_code == 200
    body = response.json()
    assert body["total"] >= 1
    assert {item["region"] for item in body["items"]} == {"Central"}
    assert "ALM-0014" in {item["alarm_id"] for item in body["items"]}


def test_get_alarms_filter_status(client: TestClient) -> None:
    response = client.get("/alarms", params={"status": "acknowledged", "page_size": 100})
    assert response.status_code == 200
    body = response.json()
    assert body["total"] >= 1
    assert {item["status"] for item in body["items"]} == {"acknowledged"}


def test_get_alarms_combined_filters(client: TestClient) -> None:
    response = client.get(
        "/alarms",
        params={
            "site_id": "SITE-003",
            "severity": "critical",
            "region": "East",
            "status": "active",
            "page_size": 100,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 3
    assert [item["alarm_id"] for item in body["items"]] == ["ALM-0003", "ALM-0002", "ALM-0001"]


def test_get_alarms_empty_results_for_unknown_site_filter(client: TestClient) -> None:
    response = client.get("/alarms", params={"site_id": "SITE-DOES-NOT-EXIST"})
    assert response.status_code == 200
    body = response.json()
    assert body["items"] == []
    assert body["total"] == 0
    assert body["page"] == 1
    assert body["page_size"] == 25


def test_get_alarms_rejects_invalid_filters(client: TestClient) -> None:
    assert client.get("/alarms", params={"severity": "catastrophic"}).status_code == 422
    assert client.get("/alarms", params={"status": "OPEN"}).status_code == 422


def test_get_alarms_pagination_boundaries(client: TestClient) -> None:
    assert client.get("/alarms", params={"page": 0}).status_code == 422
    assert client.get("/alarms", params={"page_size": 0}).status_code == 422
    assert client.get("/alarms", params={"page_size": 101}).status_code == 422

    last_page = client.get("/alarms", params={"page": 4, "page_size": 25})
    assert last_page.status_code == 200
    last_body = last_page.json()
    assert last_body["total"] == FIXTURE_ALARM_COUNT
    assert last_body["page"] == 4
    assert last_body["page_size"] == 25
    assert len(last_body["items"]) == 25

    beyond = client.get("/alarms", params={"page": 5, "page_size": 25})
    assert beyond.status_code == 200
    beyond_body = beyond.json()
    assert beyond_body["total"] == FIXTURE_ALARM_COUNT
    assert beyond_body["items"] == []
    assert beyond_body["page"] == 5
    assert beyond_body["page_size"] == 25

from __future__ import annotations

from datetime import UTC, datetime

from fastapi.testclient import TestClient

from app.schemas.telemetry import TelemetryMetric
from app.utils.timestamps import parse_utc_datetime

SITE_001_METRIC_COUNT = 12


def _new_metric(**overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "metric_id": "MET-00300",
        "site_id": "SITE-001",
        "timestamp": "2026-10-21T12:00:00+00:00",
        "latency_ms": 18.5,
        "throughput_mbps": 150.0,
        "utilization_pct": 32.0,
        "dropped_call_rate": 0.4,
    }
    payload.update(overrides)
    return payload


def test_post_telemetry_creates_measurement(client: TestClient) -> None:
    response = client.post("/telemetry", json=_new_metric())
    assert response.status_code == 201
    created = TelemetryMetric.model_validate(response.json())
    assert created.metric_id == "MET-00300"
    assert created.site_id == "SITE-001"
    assert created.dropped_call_rate_pct == 0.4
    assert response.headers["location"] == "/telemetry/MET-00300"

    listed = client.get("/sites/SITE-001/metrics", params={"page_size": 100})
    assert listed.status_code == 200
    ids = [item["metric_id"] for item in listed.json()["items"]]
    assert "MET-00300" in ids
    assert listed.json()["total"] == SITE_001_METRIC_COUNT + 1


def test_post_telemetry_assigns_id_when_omitted(client: TestClient) -> None:
    payload = _new_metric()
    del payload["metric_id"]
    response = client.post("/telemetry", json=payload)
    assert response.status_code == 201
    assert response.json()["metric_id"] == "MET-00241"


def test_post_telemetry_rejects_missing_fields(client: TestClient) -> None:
    response = client.post("/telemetry", json={"metric_id": "MET-1"})
    assert response.status_code == 422


def test_post_telemetry_rejects_invalid_kpi_values(client: TestClient) -> None:
    assert client.post("/telemetry", json=_new_metric(latency_ms=-1)).status_code == 422
    assert client.post("/telemetry", json=_new_metric(throughput_mbps=-0.01)).status_code == 422
    assert client.post("/telemetry", json=_new_metric(utilization_pct=150)).status_code == 422
    assert client.post("/telemetry", json=_new_metric(dropped_call_rate=-2)).status_code == 422


def test_post_telemetry_rejects_naive_timestamp(client: TestClient) -> None:
    response = client.post("/telemetry", json=_new_metric(timestamp="2026-10-21T12:00:00"))
    assert response.status_code == 422


def test_post_telemetry_normalizes_timestamp_to_utc(client: TestClient) -> None:
    response = client.post(
        "/telemetry",
        json=_new_metric(timestamp="2026-10-21T17:30:00+05:30"),
    )
    assert response.status_code == 201
    parsed = parse_utc_datetime(response.json()["timestamp"])
    assert parsed == datetime(2026, 10, 21, 12, 0, tzinfo=UTC)
    assert parsed.utcoffset().total_seconds() == 0


def test_post_telemetry_rejects_unknown_site(client: TestClient) -> None:
    response = client.post("/telemetry", json=_new_metric(site_id="SITE-DOES-NOT-EXIST"))
    assert response.status_code == 404
    detail = response.json()["detail"]
    assert "SITE-DOES-NOT-EXIST" in detail
    assert "SITE-001" not in detail


def test_post_telemetry_rejects_duplicate_id(client: TestClient) -> None:
    original = client.get("/sites/SITE-001/metrics", params={"page_size": 100})
    original_latency = next(
        item["latency_ms"] for item in original.json()["items"] if item["metric_id"] == "MET-00001"
    )

    response = client.post(
        "/telemetry",
        json=_new_metric(metric_id="MET-00001", latency_ms=1.0),
    )
    assert response.status_code == 409
    assert "MET-00001" in response.json()["detail"]

    after = client.get("/sites/SITE-001/metrics", params={"page_size": 100})
    after_latency = next(
        item["latency_ms"] for item in after.json()["items"] if item["metric_id"] == "MET-00001"
    )
    assert after_latency == original_latency
    assert after.json()["total"] == original.json()["total"]


def test_get_site_metrics_returns_sorted_records(client: TestClient) -> None:
    response = client.get("/sites/SITE-001/metrics", params={"page_size": 100})
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == SITE_001_METRIC_COUNT
    assert body["page"] == 1
    assert body["page_size"] == 100
    assert len(body["items"]) == SITE_001_METRIC_COUNT
    assert {item["site_id"] for item in body["items"]} == {"SITE-001"}
    timestamps = [parse_utc_datetime(item["timestamp"]) for item in body["items"]]
    ids = [item["metric_id"] for item in body["items"]]
    assert timestamps == sorted(timestamps)
    assert ids == sorted(ids)
    assert timestamps[0] == datetime(2026, 10, 19, 0, 0, tzinfo=UTC)
    assert timestamps[-1] == datetime(2026, 10, 19, 11, 0, tzinfo=UTC)


def test_get_site_metrics_unknown_site_returns_404(client: TestClient) -> None:
    response = client.get("/sites/SITE-DOES-NOT-EXIST/metrics")
    assert response.status_code == 404
    assert "SITE-DOES-NOT-EXIST" in response.json()["detail"]


def test_get_site_metrics_time_range_filter(client: TestClient) -> None:
    response = client.get(
        "/sites/SITE-001/metrics",
        params={
            "start_time": "2026-10-19T01:00:00+00:00",
            "end_time": "2026-10-19T03:00:00+00:00",
            "page_size": 100,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 3
    assert [item["metric_id"] for item in body["items"]] == [
        "MET-00021",
        "MET-00041",
        "MET-00061",
    ]


def test_get_site_metrics_normalizes_filter_timestamps(client: TestClient) -> None:
    response = client.get(
        "/sites/SITE-001/metrics",
        params={
            "start_time": "2026-10-19T06:30:00+05:30",
            "end_time": "2026-10-19T07:30:00+05:30",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 2
    assert [item["metric_id"] for item in body["items"]] == ["MET-00021", "MET-00041"]


def test_get_site_metrics_rejects_invalid_time_range(client: TestClient) -> None:
    inverted = client.get(
        "/sites/SITE-001/metrics",
        params={
            "start_time": "2026-10-19T03:00:00+00:00",
            "end_time": "2026-10-19T01:00:00+00:00",
        },
    )
    assert inverted.status_code == 422

    naive = client.get(
        "/sites/SITE-001/metrics",
        params={"start_time": "2026-10-19T01:00:00"},
    )
    assert naive.status_code == 422


def test_get_site_metrics_empty_results_for_existing_site(client: TestClient) -> None:
    response = client.get(
        "/sites/SITE-001/metrics",
        params={
            "start_time": "2026-10-20T00:00:00+00:00",
            "end_time": "2026-10-20T23:59:00+00:00",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["items"] == []
    assert body["total"] == 0
    assert body["page"] == 1
    assert body["page_size"] == 25


def test_get_site_metrics_pagination(client: TestClient) -> None:
    assert client.get("/sites/SITE-001/metrics", params={"page": 0}).status_code == 422
    assert client.get("/sites/SITE-001/metrics", params={"page_size": 0}).status_code == 422
    assert client.get("/sites/SITE-001/metrics", params={"page_size": 101}).status_code == 422

    first = client.get("/sites/SITE-001/metrics", params={"page": 1, "page_size": 5})
    assert first.status_code == 200
    first_body = first.json()
    assert first_body["total"] == SITE_001_METRIC_COUNT
    assert first_body["page"] == 1
    assert first_body["page_size"] == 5
    assert len(first_body["items"]) == 5
    assert first_body["items"][0]["metric_id"] == "MET-00001"

    last = client.get("/sites/SITE-001/metrics", params={"page": 3, "page_size": 5})
    assert last.status_code == 200
    last_body = last.json()
    assert last_body["total"] == SITE_001_METRIC_COUNT
    assert len(last_body["items"]) == 2
    assert last_body["items"][-1]["metric_id"] == "MET-00221"

    beyond = client.get("/sites/SITE-001/metrics", params={"page": 4, "page_size": 5})
    assert beyond.status_code == 200
    assert beyond.json()["items"] == []
    assert beyond.json()["total"] == SITE_001_METRIC_COUNT


def test_phase1_site_lookup_still_works(client: TestClient) -> None:
    response = client.get("/sites/SITE-001")
    assert response.status_code == 200
    assert response.json()["site_id"] == "SITE-001"

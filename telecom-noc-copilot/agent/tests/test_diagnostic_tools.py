from __future__ import annotations

import json
from typing import Any

import httpx
import pytest

from agent.config import AgentSettings
from agent.tools.api_client import NocApiClient
from agent.tools.diagnostic_tools import (
    get_active_alarms,
    get_network_topology,
    get_recent_deployments,
    get_site_details,
    get_site_metrics,
)


def _settings(**overrides: Any) -> AgentSettings:
    values = {
        "noc_api_base_url": "http://noc.test",
        "noc_api_connect_timeout": 1.0,
        "noc_api_read_timeout": 1.0,
        "noc_tool_max_results": 50,
    }
    values.update(overrides)
    return AgentSettings(**values)


def _json_response(request: httpx.Request, status: int, payload: Any) -> httpx.Response:
    return httpx.Response(
        status_code=status,
        json=payload,
        request=request,
        headers={"Content-Type": "application/json"},
    )


def _client_for(handler: Any) -> NocApiClient:
    transport = httpx.MockTransport(handler)
    return NocApiClient(settings=_settings(), transport=transport)


@pytest.mark.asyncio
async def test_get_active_alarms_success() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/alarms"
        status = request.url.params.get("status")
        items = []
        if status == "active":
            items = [
                {
                    "alarm_id": "ALM-1",
                    "site_id": "SITE-003",
                    "alarm_code": "SITE_UNREACHABLE",
                    "severity": "critical",
                    "status": "active",
                    "timestamp": "2026-10-19T01:00:00+00:00",
                    "message": "Site unreachable",
                    "technology": "5G",
                }
            ]
        return _json_response(
            request,
            200,
            {"items": items, "total": len(items), "page": 1, "page_size": 25, "as_of": "2026-10-19T01:00:00+00:00"},
        )

    async with _client_for(handler) as client:
        result = await get_active_alarms(site_id="SITE-003", client=client)

    assert result["error"] is not True if "error" in result else True
    assert result["count"] == 1
    assert result["alarms"][0]["alarm_id"] == "ALM-1"
    assert result["alarms"][0]["alarm_type"] == "SITE_UNREACHABLE"


@pytest.mark.asyncio
async def test_get_site_metrics_success_and_metric_filter() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/sites/SITE-007/metrics"
        return _json_response(
            request,
            200,
            {
                "items": [
                    {
                        "metric_id": "MET-1",
                        "site_id": "SITE-007",
                        "timestamp": "2026-10-19T07:00:00+00:00",
                        "latency_ms": 40.0,
                        "throughput_mbps": 100.0,
                        "utilization_pct": 80.0,
                        "dropped_call_rate_pct": 1.5,
                        "state": "normal",
                    }
                ],
                "total": 1,
                "page": 1,
                "page_size": 50,
                "as_of": "2026-10-19T07:00:00+00:00",
            },
        )

    async with _client_for(handler) as client:
        result = await get_site_metrics(
            site_id="SITE-007",
            metric_name="latency_ms",
            client=client,
        )

    assert result["count"] == 1
    assert result["metrics"][0]["metric_name"] == "latency_ms"
    assert result["metrics"][0]["unit"] == "ms"
    assert result["metrics"][0]["value"] == 40.0


@pytest.mark.asyncio
async def test_get_site_details_success() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/sites/SITE-003"
        return _json_response(
            request,
            200,
            {
                "site_id": "SITE-003",
                "site_name": "Alpha",
                "region": "North",
                "technology": "5G",
                "vendor": "VendorA",
                "status": "down",
                "latitude": 12.0,
                "longitude": 77.0,
                "equipment": [{"equipment_id": "EQ-1", "site_id": "SITE-003", "component": "RRU", "vendor": "VendorA", "software_version": "1.0", "operational_state": "down"}],
                "topology": [{"link_id": "LINK-003", "source_id": "SITE-003", "target_id": "AGG-03", "link_type": "microwave", "status": "down", "capacity_mbps": 300}],
            },
        )

    async with _client_for(handler) as client:
        result = await get_site_details(site_id="SITE-003", client=client)

    assert result["site"]["site_id"] == "SITE-003"
    assert result["site"]["location"]["latitude"] == 12.0
    assert len(result["site"]["equipment"]) == 1
    assert len(result["site"]["topology"]) == 1


@pytest.mark.asyncio
async def test_get_recent_deployments_success() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/deployments"
        return _json_response(
            request,
            200,
            {
                "items": [
                    {
                        "deployment_id": "DEP-001",
                        "site_id": "SITE-012",
                        "timestamp": "2026-10-19T05:00:00+00:00",
                        "change_type": "software",
                        "version_before": "R20",
                        "version_after": "R21",
                        "status": "completed_with_warning",
                        "notes": "Synthetic rollout",
                    }
                ],
                "total": 1,
                "page": 1,
                "page_size": 25,
                "as_of": "2026-10-19T05:00:00+00:00",
            },
        )

    async with _client_for(handler) as client:
        result = await get_recent_deployments(site_id="SITE-012", client=client)

    assert result["count"] == 1
    assert result["deployments"][0]["deployment_id"] == "DEP-001"
    assert result["deployments"][0]["deployment_type"] == "software"


@pytest.mark.asyncio
async def test_get_network_topology_success() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/topology"
        return _json_response(
            request,
            200,
            {
                "items": [
                    {
                        "link_id": "LINK-003",
                        "source_id": "SITE-003",
                        "target_id": "AGG-03",
                        "link_type": "microwave",
                        "status": "down",
                        "capacity_mbps": 300,
                    }
                ],
                "nodes": [
                    {"node_id": "SITE-003", "node_kind": "site", "site_id": "SITE-003", "region": "North"},
                    {"node_id": "AGG-03", "node_kind": "aggregation"},
                ],
                "total": 1,
                "page": 1,
                "page_size": 100,
                "as_of": "2026-10-19T00:00:00+00:00",
            },
        )

    async with _client_for(handler) as client:
        result = await get_network_topology(site_id="SITE-003", client=client)

    assert result["count"] == 1
    assert result["links"][0]["link_id"] == "LINK-003"
    assert len(result["nodes"]) == 2


@pytest.mark.asyncio
async def test_missing_required_site_id() -> None:
    async with _client_for(lambda request: _json_response(request, 200, {})) as client:
        result = await get_site_details(site_id="", client=client)
    assert result["error"] is True
    assert result["code"] == "validation_error"


@pytest.mark.asyncio
async def test_invalid_site_id() -> None:
    async with _client_for(lambda request: _json_response(request, 200, {})) as client:
        result = await get_site_metrics(site_id="BAD", client=client)
    assert result["error"] is True
    assert result["code"] == "validation_error"
    assert "SITE-" in result["message"]


@pytest.mark.asyncio
async def test_invalid_timestamp() -> None:
    async with _client_for(lambda request: _json_response(request, 200, {})) as client:
        result = await get_site_metrics(
            site_id="SITE-001",
            start_time="not-a-timestamp",
            client=client,
        )
    assert result["error"] is True
    assert result["code"] == "validation_error"


@pytest.mark.asyncio
async def test_invalid_time_range() -> None:
    async with _client_for(lambda request: _json_response(request, 200, {})) as client:
        result = await get_site_metrics(
            site_id="SITE-001",
            start_time="2026-10-20T00:00:00+00:00",
            end_time="2026-10-19T00:00:00+00:00",
            client=client,
        )
    assert result["error"] is True
    assert result["code"] == "validation_error"
    assert "start_time" in result["message"]


@pytest.mark.asyncio
async def test_empty_result_set() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return _json_response(
            request,
            200,
            {"items": [], "total": 0, "page": 1, "page_size": 25, "as_of": "2026-10-19T00:00:00+00:00"},
        )

    async with _client_for(handler) as client:
        result = await get_recent_deployments(region="Nowhere", client=client)
    assert result["count"] == 0
    assert result["deployments"] == []


@pytest.mark.asyncio
async def test_backend_404() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return _json_response(request, 404, {"detail": "Site SITE-999 was not found"})

    async with _client_for(handler) as client:
        result = await get_site_details(site_id="SITE-999", client=client)
    assert result["error"] is True
    assert result["code"] == "not_found"
    assert result["status_code"] == 404


@pytest.mark.asyncio
async def test_backend_500() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return _json_response(request, 500, {"detail": "boom"})

    async with _client_for(handler) as client:
        result = await get_active_alarms(client=client)
    assert result["error"] is True
    assert result["code"] == "backend_unavailable"
    assert "boom" not in json.dumps(result)


@pytest.mark.asyncio
async def test_backend_timeout() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("timed out", request=request)

    async with _client_for(handler) as client:
        result = await get_network_topology(client=client)
    assert result["error"] is True
    assert result["code"] == "timeout"


@pytest.mark.asyncio
async def test_invalid_api_json_response() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            status_code=200,
            content=b"not-json",
            request=request,
            headers={"Content-Type": "application/json"},
        )

    async with _client_for(handler) as client:
        result = await get_site_details(site_id="SITE-001", client=client)
    assert result["error"] is True
    assert result["code"] == "invalid_response"


@pytest.mark.asyncio
async def test_tools_are_read_only_http_get_only() -> None:
    methods: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        methods.append(request.method)
        if request.url.path.startswith("/sites/") and request.url.path.endswith("/metrics"):
            payload = {"items": [], "total": 0, "page": 1, "page_size": 25, "as_of": "2026-10-19T00:00:00+00:00"}
        elif request.url.path.startswith("/sites/"):
            payload = {
                "site_id": "SITE-001",
                "site_name": "A",
                "region": "North",
                "technology": "5G",
                "vendor": "V",
                "status": "up",
                "latitude": 1.0,
                "longitude": 2.0,
                "equipment": [],
                "topology": [],
            }
        else:
            payload = {
                "items": [],
                "nodes": [],
                "total": 0,
                "page": 1,
                "page_size": 25,
                "as_of": "2026-10-19T00:00:00+00:00",
            }
        return _json_response(request, 200, payload)

    async with _client_for(handler) as client:
        await get_active_alarms(client=client)
        await get_site_metrics(site_id="SITE-001", client=client)
        await get_site_details(site_id="SITE-001", client=client)
        await get_recent_deployments(client=client)
        await get_network_topology(client=client)

    assert methods
    assert set(methods) == {"GET"}

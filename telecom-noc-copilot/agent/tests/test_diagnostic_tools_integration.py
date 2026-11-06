"""Integration tests against the FastAPI app (JSON fixtures, no Postgres)."""

from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from agent.config import AgentSettings
from agent.tools.api_client import NocApiClient
from agent.tools.diagnostic_tools import (
    get_active_alarms,
    get_network_topology,
    get_recent_deployments,
    get_site_details,
    get_site_metrics,
)


@pytest.fixture
def fastapi_app(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("DATABASE_DISABLED", "true")
    from app.api.deps import get_json_oss_repository
    from app.db.session import reset_engine
    from app.main import app
    from app.utils.settings import get_settings

    get_settings.cache_clear()
    get_json_oss_repository.cache_clear()
    reset_engine()
    yield app
    get_json_oss_repository.cache_clear()
    get_settings.cache_clear()
    reset_engine()


@pytest.fixture
async def api_client(fastapi_app) -> NocApiClient:
    transport = ASGITransport(app=fastapi_app)
    settings = AgentSettings(
        noc_api_base_url="http://test",
        noc_api_connect_timeout=5.0,
        noc_api_read_timeout=15.0,
        noc_tool_max_results=100,
    )
    http = AsyncClient(transport=transport, base_url="http://test")
    client = NocApiClient(settings=settings, client=http)
    try:
        yield client
    finally:
        await http.aclose()


@pytest.mark.asyncio
async def test_integration_get_site_details(api_client: NocApiClient) -> None:
    result = await get_site_details(site_id="SITE-003", client=api_client)
    assert "error" not in result or result.get("error") is not True
    assert result["site"]["site_id"] == "SITE-003"
    assert result["site"]["site_name"]
    assert isinstance(result["site"]["equipment"], list)
    assert isinstance(result["site"]["topology"], list)


@pytest.mark.asyncio
async def test_integration_get_active_alarms(api_client: NocApiClient) -> None:
    result = await get_active_alarms(limit=10, client=api_client)
    assert result["count"] >= 0
    assert isinstance(result["alarms"], list)
    for alarm in result["alarms"]:
        assert alarm["status"] in {"active", "acknowledged"}


@pytest.mark.asyncio
async def test_integration_get_site_metrics(api_client: NocApiClient) -> None:
    result = await get_site_metrics(site_id="SITE-007", client=api_client)
    assert "error" not in result or result.get("error") is not True
    assert result["site_id"] == "SITE-007"
    assert result["count"] >= 0


@pytest.mark.asyncio
async def test_integration_get_recent_deployments(api_client: NocApiClient) -> None:
    result = await get_recent_deployments(limit=5, client=api_client)
    assert result["count"] >= 1
    assert result["deployments"][0]["deployment_id"]


@pytest.mark.asyncio
async def test_integration_get_network_topology(api_client: NocApiClient) -> None:
    result = await get_network_topology(site_id="SITE-003", client=api_client)
    assert "error" not in result or result.get("error") is not True
    assert result["count"] >= 1
    assert result["links"][0]["source_id"] == "SITE-003" or result["links"][0]["target_id"] == "SITE-003"
    assert result["nodes"]


@pytest.mark.asyncio
async def test_integration_unknown_site_404(api_client: NocApiClient) -> None:
    result = await get_site_details(site_id="SITE-999", client=api_client)
    assert result["error"] is True
    assert result["code"] == "not_found"

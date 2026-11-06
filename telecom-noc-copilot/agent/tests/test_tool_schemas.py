from __future__ import annotations

from agent.tools.tool_schemas import (
    DIAGNOSTIC_TOOL_SCHEMAS,
    get_tool_handler,
    list_mcp_tools,
)


def test_five_mcp_tool_schemas_are_defined() -> None:
    names = [item["name"] for item in DIAGNOSTIC_TOOL_SCHEMAS]
    assert names == [
        "get_active_alarms",
        "get_site_metrics",
        "get_site_details",
        "get_recent_deployments",
        "get_network_topology",
    ]


def test_mcp_schemas_have_required_fields() -> None:
    for tool in list_mcp_tools():
        assert tool["name"]
        assert tool["description"]
        schema = tool["inputSchema"]
        assert schema["type"] == "object"
        assert schema["additionalProperties"] is False
        assert "properties" in schema
        assert "required" in schema


def test_required_site_id_tools() -> None:
    by_name = {item["name"]: item for item in DIAGNOSTIC_TOOL_SCHEMAS}
    assert by_name["get_site_metrics"]["inputSchema"]["required"] == ["site_id"]
    assert by_name["get_site_details"]["inputSchema"]["required"] == ["site_id"]
    assert by_name["get_active_alarms"]["inputSchema"]["required"] == []


def test_handler_mapping() -> None:
    handler = get_tool_handler("get_site_details")
    assert callable(handler)
    assert handler.__name__ == "get_site_details"


def test_unknown_handler_raises() -> None:
    try:
        get_tool_handler("delete_everything")
        raise AssertionError("expected KeyError")
    except KeyError as exc:
        assert "Unknown diagnostic tool" in str(exc)

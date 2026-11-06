"""MCP-compatible JSON schemas for diagnostic tools.

These definitions are transport-agnostic. A future MCP server can register
``DIAGNOSTIC_TOOLS`` and dispatch ``name`` to the matching Python function in
``diagnostic_tools.py`` without embedding AgentCore or LangGraph coupling.
"""

from __future__ import annotations

from typing import Any, Callable

SITE_ID_PATTERN = r"^SITE-\d{3,}$"

GET_ACTIVE_ALARMS_SCHEMA: dict[str, Any] = {
    "name": "get_active_alarms",
    "description": (
        "Retrieve active (or acknowledged) network alarms from the NOC mock OSS API. "
        "Read-only. Optional filters: site_id, region, severity, technology, limit."
    ),
    "inputSchema": {
        "type": "object",
        "properties": {
            "site_id": {
                "type": "string",
                "description": "Unique network site identifier (for example SITE-003).",
                "pattern": SITE_ID_PATTERN,
                "minLength": 1,
                "maxLength": 64,
            },
            "region": {
                "type": "string",
                "description": "Geographic region filter (for example North, South).",
                "minLength": 1,
                "maxLength": 64,
            },
            "severity": {
                "type": "string",
                "description": "Alarm severity filter.",
                "enum": ["critical", "major", "minor", "warning", "info", "cleared"],
            },
            "technology": {
                "type": "string",
                "description": "Radio technology filter applied after API retrieval (for example 4G, 5G).",
                "minLength": 1,
                "maxLength": 32,
            },
            "limit": {
                "type": "integer",
                "description": "Maximum number of alarms to return.",
                "minimum": 1,
                "maximum": 100,
                "default": 25,
            },
        },
        "required": [],
        "additionalProperties": False,
    },
}

GET_SITE_METRICS_SCHEMA: dict[str, Any] = {
    "name": "get_site_metrics",
    "description": (
        "Retrieve telemetry KPI samples for a network site. Read-only. "
        "Supports optional ISO 8601 start_time/end_time and metric_name filters."
    ),
    "inputSchema": {
        "type": "object",
        "properties": {
            "site_id": {
                "type": "string",
                "description": "Unique network site identifier.",
                "pattern": SITE_ID_PATTERN,
                "minLength": 1,
                "maxLength": 64,
            },
            "start_time": {
                "type": "string",
                "description": "Inclusive UTC start timestamp (ISO 8601 with timezone offset).",
                "format": "date-time",
            },
            "end_time": {
                "type": "string",
                "description": "Inclusive UTC end timestamp (ISO 8601 with timezone offset).",
                "format": "date-time",
            },
            "metric_name": {
                "type": "string",
                "description": (
                    "Optional KPI name filter: latency_ms, throughput_mbps, "
                    "utilization_pct, or dropped_call_rate_pct."
                ),
                "enum": [
                    "latency_ms",
                    "throughput_mbps",
                    "utilization_pct",
                    "dropped_call_rate_pct",
                ],
            },
        },
        "required": ["site_id"],
        "additionalProperties": False,
    },
}

GET_SITE_DETAILS_SCHEMA: dict[str, Any] = {
    "name": "get_site_details",
    "description": (
        "Retrieve network site inventory and configuration details, including "
        "equipment and site-local topology links. Read-only."
    ),
    "inputSchema": {
        "type": "object",
        "properties": {
            "site_id": {
                "type": "string",
                "description": "Unique network site identifier.",
                "pattern": SITE_ID_PATTERN,
                "minLength": 1,
                "maxLength": 64,
            },
        },
        "required": ["site_id"],
        "additionalProperties": False,
    },
}

GET_RECENT_DEPLOYMENTS_SCHEMA: dict[str, Any] = {
    "name": "get_recent_deployments",
    "description": (
        "Retrieve recent network deployment / change events. Read-only. "
        "Optional filters: site_id, region, status, limit."
    ),
    "inputSchema": {
        "type": "object",
        "properties": {
            "site_id": {
                "type": "string",
                "description": "Unique network site identifier.",
                "pattern": SITE_ID_PATTERN,
                "minLength": 1,
                "maxLength": 64,
            },
            "region": {
                "type": "string",
                "description": "Geographic region filter.",
                "minLength": 1,
                "maxLength": 64,
            },
            "status": {
                "type": "string",
                "description": "Deployment status filter.",
                "enum": [
                    "in_progress",
                    "completed",
                    "completed_with_warning",
                    "failed",
                    "rolled_back",
                ],
            },
            "limit": {
                "type": "integer",
                "description": "Maximum number of deployments to return.",
                "minimum": 1,
                "maximum": 100,
                "default": 25,
            },
        },
        "required": [],
        "additionalProperties": False,
    },
}

GET_NETWORK_TOPOLOGY_SCHEMA: dict[str, Any] = {
    "name": "get_network_topology",
    "description": (
        "Retrieve synthetic network topology links and nodes. Read-only. "
        "Optional filters: site_id, region."
    ),
    "inputSchema": {
        "type": "object",
        "properties": {
            "site_id": {
                "type": "string",
                "description": "Restrict topology to links involving this site.",
                "pattern": SITE_ID_PATTERN,
                "minLength": 1,
                "maxLength": 64,
            },
            "region": {
                "type": "string",
                "description": "Restrict topology to sites in this region.",
                "minLength": 1,
                "maxLength": 64,
            },
        },
        "required": [],
        "additionalProperties": False,
    },
}

DIAGNOSTIC_TOOL_SCHEMAS: list[dict[str, Any]] = [
    GET_ACTIVE_ALARMS_SCHEMA,
    GET_SITE_METRICS_SCHEMA,
    GET_SITE_DETAILS_SCHEMA,
    GET_RECENT_DEPLOYMENTS_SCHEMA,
    GET_NETWORK_TOPOLOGY_SCHEMA,
]


def list_mcp_tools() -> list[dict[str, Any]]:
    """Return MCP ``tools/list`` style descriptors."""
    return [dict(item) for item in DIAGNOSTIC_TOOL_SCHEMAS]


def get_tool_handler(name: str) -> Callable[..., Any]:
    """Map an MCP tool name to the Python coroutine that executes it."""
    from agent.tools import diagnostic_tools

    handlers: dict[str, Callable[..., Any]] = {
        "get_active_alarms": diagnostic_tools.get_active_alarms,
        "get_site_metrics": diagnostic_tools.get_site_metrics,
        "get_site_details": diagnostic_tools.get_site_details,
        "get_recent_deployments": diagnostic_tools.get_recent_deployments,
        "get_network_topology": diagnostic_tools.get_network_topology,
    }
    try:
        return handlers[name]
    except KeyError as exc:
        raise KeyError(f"Unknown diagnostic tool: {name}") from exc

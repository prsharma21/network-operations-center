# Day 15 — Diagnostic Tool Layer

Read-only diagnostic tools that let the future AI agent retrieve telecom network
evidence from the existing FastAPI mock OSS APIs. Tools are MCP-schema ready but
are **not** deployed through AgentCore Gateway in this phase.

## 1. Architecture and execution flow

```
Agent / pytest / future MCP server
        │
        │  async Python call (get_active_alarms, …)
        ▼
agent/tools/diagnostic_tools.py
        │  validate args (Pydantic)
        ▼
agent/tools/api_client.py  (httpx AsyncClient)
        │  GET http://localhost:8000/...
        ▼
FastAPI backend (uvicorn)
        │
        ▼
JSON fixtures and/or PostgreSQL (existing OSS repositories)
```

Design constraints:

- Tool execution is separate from MCP transport and LangGraph.
- JSON schemas in `tool_schemas.py` are reusable for a future MCP server.
- All five tools are strictly **GET / read-only**.

## 2. Existing API endpoint mapping

| Diagnostic tool | Existing API endpoint | HTTP method | Required parameters |
|---|---|---|---|
| `get_active_alarms` | `/alarms` | GET | optional: `site_id`, `region`, `severity`, `status`, `page`, `page_size` |
| `get_site_metrics` | `/sites/{site_id}/metrics` | GET | `site_id`; optional: `start_time`, `end_time`, `page`, `page_size` |
| `get_site_details` | `/sites/{site_id}` | GET | `site_id` |
| `get_recent_deployments` | `/deployments` | GET | optional: `site_id`, `region`, `status`, `start_time`, `end_time`, `page`, `page_size` |
| `get_network_topology` | `/topology` | GET | optional: `site_id`, `region`, `page`, `page_size` |

### Gap filled in Day 15

Topology links already existed in `data/topology/network_topology.json` and were
embedded on `GET /sites/{site_id}`. There was no list endpoint for region-wide
queries. Day 15 added a minimal read-only `GET /topology` that reuses the same
JSON dataset (no new tables or fixtures).

`technology` is not a FastAPI query parameter on `/alarms`. The tool filters
`technology` client-side after retrieval. Active alarms are collected with
`status=active` and `status=acknowledged`.

## 3. Tool descriptions and arguments

### `get_active_alarms`

Optional: `site_id`, `region`, `severity`, `technology`, `limit` (1–100).

Returns alarm IDs, site IDs, severity, alarm type, status, timestamps, descriptions.

### `get_site_metrics`

Required: `site_id`. Optional: `start_time`, `end_time`, `metric_name`.

Returns metric name, value, unit, timestamp rows derived from telemetry samples.

### `get_site_details`

Required: `site_id`.

Returns site inventory, location, technology, status, equipment, and site topology links.

### `get_recent_deployments`

Optional: `site_id`, `region`, `status`, `limit`.

Returns deployment ID, site, type, versions, status, timestamps, details.

### `get_network_topology`

Optional: `site_id`, `region`.

Returns synthetic links and nodes (sites / aggregation).

## 4. MCP-compatible JSON schemas

See `agent/tools/tool_schemas.py`.

- `list_mcp_tools()` → descriptors for MCP `tools/list`
- `get_tool_handler(name)` → Python coroutine for MCP `tools/call`

Example:

```python
{
  "name": "get_site_details",
  "description": "Retrieve network site inventory and configuration details...",
  "inputSchema": {
    "type": "object",
    "properties": {
      "site_id": {"type": "string", "description": "Unique network site identifier."}
    },
    "required": ["site_id"],
    "additionalProperties": false
  }
}
```

## 5. Environment configuration

Defined in `.env.example` (copy to `.env`; never commit secrets):

```env
NOC_API_BASE_URL=http://localhost:8000
NOC_API_CONNECT_TIMEOUT=5
NOC_API_READ_TIMEOUT=15
NOC_TOOL_MAX_RESULTS=100
```

## 6. Run locally

1. Start the backend:

```bash
cd backend
.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

2. Install agent deps (or reuse the backend venv that already has httpx/pytest):

```bash
cd agent
pip install -r requirements-dev.txt
```

3. Call a tool from Python:

```python
import asyncio
from agent.tools import get_site_details

print(asyncio.run(get_site_details(site_id="SITE-003")))
```

## 7. Tests

Backend (includes `GET /topology`):

```bash
cd backend
.venv\Scripts\pytest.exe -q
```

Agent unit + integration:

```bash
cd agent
pytest -q
```

Integration tests mount the FastAPI app with `httpx.ASGITransport` and
`DATABASE_DISABLED=true` so they use JSON fixtures without Postgres.

## 8. Future MCP / AgentCore Gateway integration

1. Keep `diagnostic_tools.py` as the execution layer.
2. In `mcp-server/`, register `list_mcp_tools()` and dispatch
   `get_tool_handler(name)(**arguments)`.
3. Expose the MCP server URL to AgentCore Gateway in a later day.
4. Do **not** couple tools to LangGraph nodes or Gateway deployment here.

## Known limitations

- Topology is synthetic fixture data, not a live OSS discovery feed.
- Alarm `technology` filtering is client-side.
- Deployment fixtures do not store a separate completion timestamp; the tool
  reuses the event timestamp when status is terminal.
- No remediation or write tools are included.

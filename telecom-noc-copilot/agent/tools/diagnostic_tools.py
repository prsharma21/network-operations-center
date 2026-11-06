"""Read-only diagnostic tools that call FastAPI mock OSS APIs.

Each public function is independently callable and MCP-transport agnostic.
"""

from __future__ import annotations

import logging
import re
import time
import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from agent.tools.api_client import NocApiClient
from agent.tools.exceptions import DiagnosticToolError, ToolValidationError

logger = logging.getLogger("telecom_noc_copilot.agent.tools")

_SITE_ID_RE = re.compile(r"^SITE-\d{3,}$")
_ACTIVE_ALARM_STATUSES = frozenset({"active", "acknowledged"})
_METRIC_NAMES = frozenset(
    {"latency_ms", "throughput_mbps", "utilization_pct", "dropped_call_rate_pct"}
)
_METRIC_UNITS = {
    "latency_ms": "ms",
    "throughput_mbps": "Mbps",
    "utilization_pct": "%",
    "dropped_call_rate_pct": "%",
}
_SEVERITIES = frozenset({"critical", "major", "minor", "warning", "info", "cleared"})
_DEPLOYMENT_STATUSES = frozenset(
    {"in_progress", "completed", "completed_with_warning", "failed", "rolled_back"}
)


def _model_config() -> ConfigDict:
    return ConfigDict(extra="forbid", str_strip_whitespace=True)


class ActiveAlarmsArgs(BaseModel):
    model_config = _model_config()

    site_id: str | None = Field(default=None, min_length=1, max_length=64)
    region: str | None = Field(default=None, min_length=1, max_length=64)
    severity: str | None = None
    technology: str | None = Field(default=None, min_length=1, max_length=32)
    limit: int = Field(default=25, ge=1, le=100)

    @field_validator("site_id")
    @classmethod
    def _site_id(cls, value: str | None) -> str | None:
        return _validate_optional_site_id(value)

    @field_validator("severity")
    @classmethod
    def _severity(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip().lower()
        if normalized not in _SEVERITIES:
            raise ValueError(f"severity must be one of: {', '.join(sorted(_SEVERITIES))}")
        return normalized


class SiteMetricsArgs(BaseModel):
    model_config = _model_config()

    site_id: str = Field(min_length=1, max_length=64)
    start_time: str | None = None
    end_time: str | None = None
    metric_name: str | None = None

    @field_validator("site_id")
    @classmethod
    def _site_id(cls, value: str) -> str:
        return _validate_site_id(value)

    @field_validator("start_time", "end_time")
    @classmethod
    def _timestamps(cls, value: str | None) -> str | None:
        if value is None or not value.strip():
            return None
        return _parse_iso_timestamp(value.strip()).isoformat()

    @field_validator("metric_name")
    @classmethod
    def _metric_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip().lower()
        if normalized not in _METRIC_NAMES:
            raise ValueError(
                "metric_name must be one of: " + ", ".join(sorted(_METRIC_NAMES))
            )
        return normalized

    @model_validator(mode="after")
    def _range(self) -> SiteMetricsArgs:
        if self.start_time and self.end_time:
            start = datetime.fromisoformat(self.start_time)
            end = datetime.fromisoformat(self.end_time)
            if start > end:
                raise ValueError("start_time must be less than or equal to end_time")
        return self


class SiteDetailsArgs(BaseModel):
    model_config = _model_config()

    site_id: str = Field(min_length=1, max_length=64)

    @field_validator("site_id")
    @classmethod
    def _site_id(cls, value: str) -> str:
        return _validate_site_id(value)


class RecentDeploymentsArgs(BaseModel):
    model_config = _model_config()

    site_id: str | None = Field(default=None, min_length=1, max_length=64)
    region: str | None = Field(default=None, min_length=1, max_length=64)
    status: str | None = None
    limit: int = Field(default=25, ge=1, le=100)

    @field_validator("site_id")
    @classmethod
    def _site_id(cls, value: str | None) -> str | None:
        return _validate_optional_site_id(value)

    @field_validator("status")
    @classmethod
    def _status(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip().lower().replace("-", "_").replace(" ", "_")
        if normalized not in _DEPLOYMENT_STATUSES:
            raise ValueError(
                "status must be one of: " + ", ".join(sorted(_DEPLOYMENT_STATUSES))
            )
        return normalized


class NetworkTopologyArgs(BaseModel):
    model_config = _model_config()

    site_id: str | None = Field(default=None, min_length=1, max_length=64)
    region: str | None = Field(default=None, min_length=1, max_length=64)

    @field_validator("site_id")
    @classmethod
    def _site_id(cls, value: str | None) -> str | None:
        return _validate_optional_site_id(value)


def _validate_site_id(value: str) -> str:
    cleaned = value.strip()
    if not _SITE_ID_RE.match(cleaned):
        raise ValueError("site_id must match SITE-NNN (for example SITE-003)")
    return cleaned


def _validate_optional_site_id(value: str | None) -> str | None:
    if value is None:
        return None
    return _validate_site_id(value)


def _parse_iso_timestamp(value: str) -> datetime:
    text = value
    if text.endswith(("Z", "z")):
        text = f"{text[:-1]}+00:00"
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError as exc:
        raise ValueError(
            "timestamp must be ISO 8601 with an explicit timezone offset"
        ) from exc
    if parsed.tzinfo is None or parsed.tzinfo.utcoffset(parsed) is None:
        raise ValueError(
            "Naive timestamps are rejected. Provide an ISO 8601 value with a timezone offset."
        )
    return parsed


def _parse_args(model_cls: type[BaseModel], raw: dict[str, Any]) -> BaseModel:
    try:
        return model_cls.model_validate(raw)
    except Exception as exc:
        message = str(exc)
        if hasattr(exc, "errors"):
            try:
                errors = exc.errors()  # type: ignore[attr-defined]
                if errors:
                    first = errors[0]
                    loc = ".".join(str(part) for part in first.get("loc", ()))
                    msg = first.get("msg", message)
                    message = f"{loc}: {msg}" if loc else str(msg)
            except Exception:
                pass
        raise ToolValidationError(message) from exc


def _clamp_limit(limit: int, max_results: int) -> int:
    return max(1, min(limit, max_results, 100))


async def _run_tool(
    tool_name: str,
    client: NocApiClient | None,
    correlation_id: str | None,
    runner: Any,
) -> dict[str, Any]:
    started = time.perf_counter()
    request_id = correlation_id or str(uuid.uuid4())
    owns_client = client is None
    api = client or NocApiClient()
    try:
        result = await runner(api, request_id)
        duration_ms = round((time.perf_counter() - started) * 1000, 2)
        logger.info(
            "event=diagnostic_tool tool=%s outcome=success correlation_id=%s duration_ms=%s",
            tool_name,
            request_id,
            duration_ms,
        )
        if isinstance(result, dict):
            result.setdefault("tool", tool_name)
            result.setdefault("correlation_id", request_id)
            result.setdefault("duration_ms", duration_ms)
        return result
    except DiagnosticToolError as exc:
        duration_ms = round((time.perf_counter() - started) * 1000, 2)
        logger.info(
            "event=diagnostic_tool tool=%s outcome=failure code=%s correlation_id=%s duration_ms=%s",
            tool_name,
            exc.code,
            request_id,
            duration_ms,
        )
        payload = exc.to_dict()
        payload["tool"] = tool_name
        payload["correlation_id"] = request_id
        payload["duration_ms"] = duration_ms
        return payload
    finally:
        if owns_client:
            await api.aclose()


async def get_active_alarms(
    *,
    site_id: str | None = None,
    region: str | None = None,
    severity: str | None = None,
    technology: str | None = None,
    limit: int = 25,
    client: NocApiClient | None = None,
    correlation_id: str | None = None,
) -> dict[str, Any]:
    """Retrieve active/acknowledged alarms from GET /alarms."""

    async def _execute(api: NocApiClient, request_id: str) -> dict[str, Any]:
        args = _parse_args(
            ActiveAlarmsArgs,
            {
                "site_id": site_id,
                "region": region,
                "severity": severity,
                "technology": technology,
                "limit": limit,
            },
        )
        assert isinstance(args, ActiveAlarmsArgs)
        page_size = _clamp_limit(args.limit, api.max_results)
        # Fetch active and acknowledged separately; API status is a single value.
        combined: list[dict[str, Any]] = []
        for status in ("active", "acknowledged"):
            payload = await api.get_json(
                "/alarms",
                params={
                    "site_id": args.site_id,
                    "region": args.region,
                    "severity": args.severity,
                    "status": status,
                    "page": 1,
                    "page_size": page_size,
                },
                correlation_id=request_id,
            )
            items = _as_list(payload, "items")
            combined.extend(item for item in items if isinstance(item, dict))

        if args.technology:
            wanted = args.technology.casefold()
            combined = [
                item
                for item in combined
                if str(item.get("technology") or "").casefold() == wanted
            ]

        # Deduplicate by alarm_id while preserving newest-first order from API.
        seen: set[str] = set()
        alarms: list[dict[str, Any]] = []
        for item in combined:
            alarm_id = str(item.get("alarm_id") or "")
            status = str(item.get("status") or "").lower()
            if not alarm_id or alarm_id in seen or status not in _ACTIVE_ALARM_STATUSES:
                continue
            seen.add(alarm_id)
            alarms.append(_normalize_alarm(item))
            if len(alarms) >= page_size:
                break

        return {
            "count": len(alarms),
            "alarms": alarms,
            "filters": {
                "site_id": args.site_id,
                "region": args.region,
                "severity": args.severity,
                "technology": args.technology,
                "limit": page_size,
                "status": "active,acknowledged",
            },
        }

    return await _run_tool("get_active_alarms", client, correlation_id, _execute)


async def get_site_metrics(
    *,
    site_id: str,
    start_time: str | None = None,
    end_time: str | None = None,
    metric_name: str | None = None,
    client: NocApiClient | None = None,
    correlation_id: str | None = None,
) -> dict[str, Any]:
    """Retrieve telemetry samples from GET /sites/{site_id}/metrics."""

    async def _execute(api: NocApiClient, request_id: str) -> dict[str, Any]:
        args = _parse_args(
            SiteMetricsArgs,
            {
                "site_id": site_id,
                "start_time": start_time,
                "end_time": end_time,
                "metric_name": metric_name,
            },
        )
        assert isinstance(args, SiteMetricsArgs)
        payload = await api.get_json(
            f"/sites/{args.site_id}/metrics",
            params={
                "start_time": args.start_time,
                "end_time": args.end_time,
                "page": 1,
                "page_size": _clamp_limit(api.max_results, api.max_results),
            },
            correlation_id=request_id,
        )
        samples = _as_list(payload, "items")
        metrics: list[dict[str, Any]] = []
        for sample in samples:
            if not isinstance(sample, dict):
                continue
            metrics.extend(_expand_metric_sample(sample, args.metric_name))

        return {
            "site_id": args.site_id,
            "count": len(metrics),
            "metrics": metrics,
            "filters": {
                "start_time": args.start_time,
                "end_time": args.end_time,
                "metric_name": args.metric_name,
            },
        }

    return await _run_tool("get_site_metrics", client, correlation_id, _execute)


async def get_site_details(
    *,
    site_id: str,
    client: NocApiClient | None = None,
    correlation_id: str | None = None,
) -> dict[str, Any]:
    """Retrieve site inventory from GET /sites/{site_id}."""

    async def _execute(api: NocApiClient, request_id: str) -> dict[str, Any]:
        args = _parse_args(SiteDetailsArgs, {"site_id": site_id})
        assert isinstance(args, SiteDetailsArgs)
        payload = await api.get_json(
            f"/sites/{args.site_id}",
            correlation_id=request_id,
        )
        if not isinstance(payload, dict):
            raise ToolValidationError("Site details response was not a JSON object.")
        return {
            "site": {
                "site_id": payload.get("site_id"),
                "site_name": payload.get("site_name"),
                "region": payload.get("region"),
                "location": {
                    "latitude": payload.get("latitude"),
                    "longitude": payload.get("longitude"),
                },
                "technology": payload.get("technology"),
                "vendor": payload.get("vendor"),
                "status": payload.get("status"),
                "site_type": payload.get("site_type"),
                "criticality": payload.get("criticality"),
                "backhaul_type": payload.get("backhaul_type"),
                "known_scenario": payload.get("known_scenario"),
                "equipment": payload.get("equipment") or [],
                "topology": payload.get("topology") or [],
                "synthetic": payload.get("synthetic", True),
            }
        }

    return await _run_tool("get_site_details", client, correlation_id, _execute)


async def get_recent_deployments(
    *,
    site_id: str | None = None,
    region: str | None = None,
    status: str | None = None,
    limit: int = 25,
    client: NocApiClient | None = None,
    correlation_id: str | None = None,
) -> dict[str, Any]:
    """Retrieve deployment events from GET /deployments."""

    async def _execute(api: NocApiClient, request_id: str) -> dict[str, Any]:
        args = _parse_args(
            RecentDeploymentsArgs,
            {
                "site_id": site_id,
                "region": region,
                "status": status,
                "limit": limit,
            },
        )
        assert isinstance(args, RecentDeploymentsArgs)
        page_size = _clamp_limit(args.limit, api.max_results)
        payload = await api.get_json(
            "/deployments",
            params={
                "site_id": args.site_id,
                "region": args.region,
                "status": args.status,
                "page": 1,
                "page_size": page_size,
            },
            correlation_id=request_id,
        )
        items = _as_list(payload, "items")
        deployments = [
            _normalize_deployment(item)
            for item in items
            if isinstance(item, dict)
        ][:page_size]
        return {
            "count": len(deployments),
            "deployments": deployments,
            "filters": {
                "site_id": args.site_id,
                "region": args.region,
                "status": args.status,
                "limit": page_size,
            },
        }

    return await _run_tool("get_recent_deployments", client, correlation_id, _execute)


async def get_network_topology(
    *,
    site_id: str | None = None,
    region: str | None = None,
    client: NocApiClient | None = None,
    correlation_id: str | None = None,
) -> dict[str, Any]:
    """Retrieve topology links/nodes from GET /topology."""

    async def _execute(api: NocApiClient, request_id: str) -> dict[str, Any]:
        args = _parse_args(
            NetworkTopologyArgs,
            {"site_id": site_id, "region": region},
        )
        assert isinstance(args, NetworkTopologyArgs)
        payload = await api.get_json(
            "/topology",
            params={
                "site_id": args.site_id,
                "region": args.region,
                "page": 1,
                "page_size": _clamp_limit(api.max_results, api.max_results),
            },
            correlation_id=request_id,
        )
        links = _as_list(payload, "items")
        nodes = _as_list(payload, "nodes")
        return {
            "count": len(links),
            "links": [item for item in links if isinstance(item, dict)],
            "nodes": [item for item in nodes if isinstance(item, dict)],
            "filters": {"site_id": args.site_id, "region": args.region},
        }

    return await _run_tool("get_network_topology", client, correlation_id, _execute)


def _as_list(payload: Any, key: str) -> list[Any]:
    if isinstance(payload, dict):
        value = payload.get(key)
        if isinstance(value, list):
            return value
    return []


def _normalize_alarm(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "alarm_id": item.get("alarm_id"),
        "site_id": item.get("site_id"),
        "severity": item.get("severity"),
        "alarm_type": item.get("alarm_code") or item.get("alarm_type"),
        "status": item.get("status"),
        "timestamp": item.get("timestamp"),
        "description": item.get("message") or item.get("description"),
        "region": item.get("region"),
        "technology": item.get("technology"),
        "site_name": item.get("site_name"),
    }


def _normalize_deployment(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "deployment_id": item.get("deployment_id"),
        "site_id": item.get("site_id"),
        "deployment_type": item.get("change_type"),
        "version_before": item.get("version_before"),
        "version": item.get("version_after") or item.get("version"),
        "status": item.get("status"),
        "start_timestamp": item.get("timestamp"),
        "completion_timestamp": item.get("timestamp")
        if str(item.get("status") or "").startswith("completed")
        or str(item.get("status") or "") in {"failed", "rolled_back"}
        else None,
        "details": item.get("notes") or item.get("change_summary"),
        "change_ticket": item.get("change_ticket"),
    }


def _expand_metric_sample(
    sample: dict[str, Any],
    metric_name: str | None,
) -> list[dict[str, Any]]:
    timestamp = sample.get("timestamp")
    site = sample.get("site_id")
    metric_id = sample.get("metric_id")
    names: tuple[str, ...]
    if metric_name:
        names = (metric_name,)
    else:
        names = (
            "latency_ms",
            "throughput_mbps",
            "utilization_pct",
            "dropped_call_rate_pct",
        )
    rows: list[dict[str, Any]] = []
    for name in names:
        if name not in sample:
            continue
        rows.append(
            {
                "metric_id": metric_id,
                "site_id": site,
                "metric_name": name,
                "value": sample.get(name),
                "unit": _METRIC_UNITS.get(name),
                "timestamp": timestamp,
                "state": sample.get("state"),
            }
        )
    return rows

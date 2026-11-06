"""Async HTTP client for FastAPI mock OSS APIs."""

from __future__ import annotations

import logging
from types import TracebackType
from typing import Any, Mapping, Self

import httpx

from agent.config import AgentSettings, get_agent_settings
from agent.tools.exceptions import (
    ToolBackendError,
    ToolConnectionError,
    ToolNotFoundError,
    ToolTimeoutError,
    ToolValidationError,
)

logger = logging.getLogger("telecom_noc_copilot.agent.api_client")


class NocApiClient:
    """Reusable async client. Prefer one instance per tool session."""

    def __init__(
        self,
        settings: AgentSettings | None = None,
        *,
        transport: httpx.AsyncBaseTransport | None = None,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self._settings = settings or get_agent_settings()
        self._owns_client = client is None
        timeout = httpx.Timeout(
            connect=self._settings.noc_api_connect_timeout,
            read=self._settings.noc_api_read_timeout,
            write=self._settings.noc_api_read_timeout,
            pool=self._settings.noc_api_connect_timeout,
        )
        self._client = client or httpx.AsyncClient(
            base_url=self._settings.noc_api_base_url,
            timeout=timeout,
            transport=transport,
            headers={"Accept": "application/json"},
        )

    @property
    def base_url(self) -> str:
        return str(self._client.base_url).rstrip("/") or self._settings.noc_api_base_url

    @property
    def max_results(self) -> int:
        return self._settings.noc_tool_max_results

    async def __aenter__(self) -> Self:
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        tb: TracebackType | None,
    ) -> None:
        await self.aclose()

    async def aclose(self) -> None:
        if self._owns_client:
            await self._client.aclose()

    async def get_json(
        self,
        path: str,
        *,
        params: Mapping[str, Any] | None = None,
        correlation_id: str | None = None,
    ) -> Any:
        query = {key: value for key, value in (params or {}).items() if value is not None}
        headers = {}
        if correlation_id:
            headers["X-Request-ID"] = correlation_id
        try:
            response = await self._client.get(path, params=query, headers=headers or None)
        except httpx.TimeoutException as exc:
            logger.warning("noc_api_timeout path=%s", path)
            raise ToolTimeoutError() from exc
        except httpx.TransportError as exc:
            logger.warning("noc_api_connection_error path=%s", path)
            raise ToolConnectionError() from exc

        return self._parse_response(path, response)

    def _parse_response(self, path: str, response: httpx.Response) -> Any:
        status = response.status_code
        if status == 400:
            raise ToolValidationError(self._safe_detail(response, "Invalid request arguments."))
        if status == 404:
            raise ToolNotFoundError(self._safe_detail(response, "Requested resource was not found."))
        if status == 422:
            raise ToolValidationError(self._safe_detail(response, "Request validation failed."))
        if status == 429:
            raise ToolBackendError(
                "The NOC API rate limit was exceeded.",
                code="rate_limited",
                status_code=429,
            )
        if status >= 500:
            raise ToolBackendError(
                "The NOC API is temporarily unavailable.",
                code="backend_unavailable",
                status_code=status,
            )
        if status >= 400:
            raise ToolBackendError(
                self._safe_detail(response, f"NOC API request failed with status {status}."),
                code="http_error",
                status_code=status,
            )

        if not response.content:
            return {}
        try:
            return response.json()
        except ValueError as exc:
            logger.warning("noc_api_invalid_json path=%s status=%s", path, status)
            raise ToolBackendError(
                "The NOC API returned an invalid JSON response.",
                code="invalid_response",
                status_code=status,
            ) from exc

    @staticmethod
    def _safe_detail(response: httpx.Response, fallback: str) -> str:
        try:
            payload = response.json()
        except ValueError:
            return fallback
        detail = payload.get("detail") if isinstance(payload, dict) else None
        if isinstance(detail, str) and detail.strip():
            return detail.strip()[:500]
        if isinstance(detail, list) and detail:
            first = detail[0]
            if isinstance(first, dict):
                msg = first.get("msg")
                if isinstance(msg, str) and msg.strip():
                    return msg.strip()[:500]
        return fallback

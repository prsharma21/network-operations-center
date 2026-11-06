"""Safe diagnostic-tool errors. Messages never include secrets or stack traces."""

from __future__ import annotations


class DiagnosticToolError(Exception):
    """Base class for tool-layer failures returned to the agent."""

    def __init__(self, message: str, *, code: str, status_code: int | None = None) -> None:
        self.message = message
        self.code = code
        self.status_code = status_code
        super().__init__(message)

    def to_dict(self) -> dict[str, object]:
        payload: dict[str, object] = {
            "error": True,
            "code": self.code,
            "message": self.message,
        }
        if self.status_code is not None:
            payload["status_code"] = self.status_code
        return payload


class ToolValidationError(DiagnosticToolError):
    def __init__(self, message: str) -> None:
        super().__init__(message, code="validation_error", status_code=400)


class ToolNotFoundError(DiagnosticToolError):
    def __init__(self, message: str) -> None:
        super().__init__(message, code="not_found", status_code=404)


class ToolBackendError(DiagnosticToolError):
    def __init__(
        self,
        message: str,
        *,
        code: str = "backend_error",
        status_code: int | None = None,
    ) -> None:
        super().__init__(message, code=code, status_code=status_code)


class ToolTimeoutError(ToolBackendError):
    def __init__(self, message: str = "The NOC API request timed out.") -> None:
        super().__init__(message, code="timeout", status_code=504)


class ToolConnectionError(ToolBackendError):
    def __init__(self, message: str = "Unable to reach the NOC API.") -> None:
        super().__init__(message, code="connection_error", status_code=503)

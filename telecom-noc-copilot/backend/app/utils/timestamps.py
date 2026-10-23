"""ISO 8601 timestamp parsing with an explicit naive-datetime policy.

Policy
------
Timezone-aware values are accepted and converted to UTC.

Naive values (no offset, for example ``2026-10-19T01:13:00``) are **rejected**.
The API never assumes UTC, local time, or any other zone for a naive timestamp
because that timezone cannot be inferred from the payload.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated, Any

from pydantic import BeforeValidator

NAIVE_TIMESTAMP_ERROR = (
    "Naive timestamps are rejected. Provide an ISO 8601 value with an explicit "
    "timezone offset (for example 2026-10-19T01:13:00+00:00 or "
    "2026-10-19T01:13:00Z). The API does not assume UTC or any other timezone "
    "for naive values."
)


def parse_utc_datetime(value: Any) -> datetime:
    """Parse an ISO 8601 timestamp and return a UTC-aware datetime."""
    if isinstance(value, datetime):
        dt = value
    elif isinstance(value, str):
        text = value.strip()
        if not text:
            raise ValueError("timestamp must not be blank")
        if text.endswith(("Z", "z")):
            text = f"{text[:-1]}+00:00"
        try:
            dt = datetime.fromisoformat(text)
        except ValueError as exc:
            raise ValueError("timestamp must be a valid ISO 8601 date-time") from exc
    else:
        raise ValueError("timestamp must be an ISO 8601 date-time string")

    if dt.tzinfo is None or dt.tzinfo.utcoffset(dt) is None:
        raise ValueError(NAIVE_TIMESTAMP_ERROR)
    return dt.astimezone(UTC)


UtcDateTime = Annotated[datetime, BeforeValidator(parse_utc_datetime)]


def parse_optional_utc_datetime(value: str | None) -> datetime | None:
    """Parse an optional ISO 8601 query timestamp, or return None when blank."""
    if value is None or not value.strip():
        return None
    return parse_utc_datetime(value)

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from pydantic import ValidationError

from app.schemas import NetworkAlarm
from app.utils.timestamps import NAIVE_TIMESTAMP_ERROR, parse_utc_datetime


def _alarm(**overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "alarm_id": "ALM-0001",
        "site_id": "SITE-003",
        "alarm_code": "SITE_UNREACHABLE",
        "severity": "critical",
        "status": "active",
        "timestamp": "2026-10-19T01:13:00+00:00",
        "message": "Backhaul path unreachable",
    }
    payload.update(overrides)
    return payload


def test_timezone_aware_timestamp_is_normalized_to_utc() -> None:
    parsed = parse_utc_datetime("2026-10-19T06:43:00+05:30")
    assert parsed.tzinfo is not None
    assert parsed.utcoffset() == timedelta(0)
    assert parsed == datetime(2026, 10, 19, 1, 13, tzinfo=UTC)


def test_zulu_timestamp_is_accepted() -> None:
    parsed = parse_utc_datetime("2026-10-19T01:13:00Z")
    assert parsed == datetime(2026, 10, 19, 1, 13, tzinfo=UTC)


def test_naive_timestamp_is_rejected() -> None:
    with pytest.raises(ValueError, match="Naive timestamps are rejected"):
        parse_utc_datetime("2026-10-19T01:13:00")


def test_alarm_schema_rejects_naive_timestamp() -> None:
    with pytest.raises(ValidationError) as exc:
        NetworkAlarm.model_validate(_alarm(timestamp="2026-10-19T01:13:00"))
    assert NAIVE_TIMESTAMP_ERROR[:40] in str(exc.value)


def test_alarm_schema_rejects_malformed_timestamp() -> None:
    with pytest.raises(ValidationError):
        NetworkAlarm.model_validate(_alarm(timestamp="not-a-timestamp"))


def test_alarm_schema_normalizes_offset_to_utc() -> None:
    alarm = NetworkAlarm.model_validate(_alarm(timestamp="2026-10-19T06:43:00+05:30"))
    assert alarm.timestamp == datetime(2026, 10, 19, 1, 13, tzinfo=UTC)

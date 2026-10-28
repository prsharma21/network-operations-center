"""Deterministic alarm fingerprint for ingest deduplication.

Preferred unique key
--------------------
``alarm_id`` or ``source_event_id`` when the client supplies one. That value is
the record identifier and is unique in the repository.

Fallback fingerprint
--------------------
When the same event is resubmitted without that identifier (or with a new one
that would otherwise create a second row), the ingest layer also keys on:

    site_id | alarm_code | utc_timestamp_to_the_second | network_component?

Fields intentionally **excluded**: severity and status (they can change during
the same event lifecycle). ``correlation_key`` is also excluded because the
synthetic feed reuses one key across several related alarms.

Limitations
-----------
Two genuine events of the same type at the same site in the same UTC second,
with the same (or both missing) component, collide. The JSON repository enforces
this in-process with a lock; a later PostgreSQL unique constraint can use the
same fingerprint string.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from app.utils.timestamps import parse_utc_datetime


def build_alarm_fingerprint(
    *,
    site_id: str,
    alarm_code: str,
    timestamp: datetime,
    network_component: str | None = None,
) -> str:
    utc = timestamp.astimezone(UTC).replace(microsecond=0).strftime("%Y-%m-%dT%H:%M:%SZ")
    parts = [site_id.strip(), alarm_code.strip().upper(), utc]
    if network_component and network_component.strip():
        parts.append(network_component.strip().casefold())
    return "|".join(parts)


def fingerprint_from_record(record: dict[str, Any]) -> str | None:
    site_id = record.get("site_id")
    alarm_code = record.get("alarm_code") or record.get("alarm_type")
    raw_ts = record.get("timestamp")
    if not isinstance(site_id, str) or not isinstance(alarm_code, str) or raw_ts is None:
        return None
    try:
        timestamp = parse_utc_datetime(raw_ts)
    except ValueError:
        return None
    component = record.get("network_component") or record.get("component")
    component_text = component.strip() if isinstance(component, str) else None
    return build_alarm_fingerprint(
        site_id=site_id,
        alarm_code=alarm_code,
        timestamp=timestamp,
        network_component=component_text,
    )

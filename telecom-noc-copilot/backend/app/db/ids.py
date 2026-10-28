"""Stable UUIDs for repeatable seed rows."""

from __future__ import annotations

from uuid import UUID, uuid5

SEED_NAMESPACE = UUID("6ba7b810-9dad-11d1-80b4-00c04fd430c8")  # UUID namespace DNS


def stable_uuid(kind: str, key: str) -> UUID:
    return uuid5(SEED_NAMESPACE, f"telecom-noc.{kind}.{key}")

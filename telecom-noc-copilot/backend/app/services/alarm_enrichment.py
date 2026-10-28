"""Enrich an ingested alarm from trusted OSS site configuration.

Policy
------
Site configuration is the source of truth for ``site_name``, ``region``,
``technology``, and ``vendor``. Client-supplied values for those fields are
**replaced** with the OSS record. They are never invented: a missing OSS field
is left unset.

``network_component`` is kept from the client when provided. The inventory has
several components per site, so the enricher does not pick one.

Raw alarm fields (code, message, timestamp, status, source severity) are not
modified.
"""

from __future__ import annotations

from typing import Any


_TRUSTED_SITE_FIELDS = ("site_name", "region", "technology", "vendor")


def enrich_alarm_from_site(
    data: dict[str, Any],
    site: dict[str, Any],
) -> dict[str, Any]:
    enriched = dict(data)
    replaced: list[str] = []
    for field in _TRUSTED_SITE_FIELDS:
        trusted = site.get(field)
        if not isinstance(trusted, str) or not trusted.strip():
            continue
        incoming = enriched.get(field)
        if isinstance(incoming, str) and incoming.strip() and incoming.strip() != trusted.strip():
            replaced.append(field)
        enriched[field] = trusted.strip()
    enriched["_enrichment_replaced"] = replaced
    return enriched

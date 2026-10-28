from __future__ import annotations

from datetime import UTC, datetime, timedelta, timezone
from pathlib import Path
from threading import Thread

from app.schemas.enums import Severity
from app.services.alarm_enrichment import enrich_alarm_from_site
from app.services.alarm_fingerprint import build_alarm_fingerprint, fingerprint_from_record
from app.services.alarm_severity import compute_alarm_severity, severity_from_kpis
from oss_api.exceptions import DuplicateAlarm
from oss_api.repository import JsonOssRepository


def test_fingerprint_uses_utc_and_excludes_severity() -> None:
    ts = datetime(2026, 10, 21, 12, 0, tzinfo=UTC)
    offset = datetime(2026, 10, 21, 17, 30, tzinfo=timezone(timedelta(hours=5, minutes=30)))
    left = build_alarm_fingerprint(
        site_id="SITE-001",
        alarm_code="HIGH_LATENCY",
        timestamp=ts,
    )
    right = build_alarm_fingerprint(
        site_id="SITE-001",
        alarm_code="high_latency",
        timestamp=offset,
    )
    assert left == right
    assert left == "SITE-001|HIGH_LATENCY|2026-10-21T12:00:00Z"


def test_fingerprint_from_offset_record_matches_utc() -> None:
    assert fingerprint_from_record(
        {
            "site_id": "SITE-001",
            "alarm_code": "HIGH_LATENCY",
            "timestamp": "2026-10-21T17:30:00+05:30",
        }
    ) == build_alarm_fingerprint(
        site_id="SITE-001",
        alarm_code="HIGH_LATENCY",
        timestamp=datetime(2026, 10, 21, 12, 0, tzinfo=UTC),
    )


def test_fingerprint_includes_component_when_present() -> None:
    ts = datetime(2026, 10, 21, 12, 0, tzinfo=UTC)
    plain = build_alarm_fingerprint(site_id="SITE-001", alarm_code="HIGH_LATENCY", timestamp=ts)
    radio = build_alarm_fingerprint(
        site_id="SITE-001",
        alarm_code="HIGH_LATENCY",
        timestamp=ts,
        network_component="radio_unit",
    )
    assert plain != radio


def test_enrichment_replaces_conflicting_client_metadata() -> None:
    enriched = enrich_alarm_from_site(
        {
            "site_id": "SITE-001",
            "region": "West",
            "site_name": "spoofed",
            "technology": "2G",
            "vendor": "Other",
        },
        {
            "site_id": "SITE-001",
            "site_name": "North-CELL-001",
            "region": "North",
            "technology": "4G",
            "vendor": "Ericsson",
        },
    )
    assert enriched["region"] == "North"
    assert enriched["site_name"] == "North-CELL-001"
    assert enriched["technology"] == "4G"
    assert enriched["vendor"] == "Ericsson"
    assert set(enriched["_enrichment_replaced"]) == {
        "region",
        "site_name",
        "technology",
        "vendor",
    }


def test_enrichment_does_not_invent_missing_site_fields() -> None:
    enriched = enrich_alarm_from_site({"site_id": "SITE-X"}, {"site_id": "SITE-X", "region": "East"})
    assert enriched["region"] == "East"
    assert "site_name" not in enriched
    assert "vendor" not in enriched


def test_kpi_boundary_values() -> None:
    assert severity_from_kpis(latency_ms=79.99) is None
    assert severity_from_kpis(latency_ms=80) is Severity.WARNING
    assert severity_from_kpis(latency_ms=149.99) is Severity.WARNING
    assert severity_from_kpis(latency_ms=150) is Severity.CRITICAL
    assert severity_from_kpis(latency_ms=900) is Severity.CRITICAL
    assert severity_from_kpis(throughput_mbps=80.01) is None
    assert severity_from_kpis(throughput_mbps=80) is Severity.WARNING
    assert severity_from_kpis(throughput_mbps=20) is Severity.CRITICAL
    assert severity_from_kpis(utilization_pct=69.99) is None
    assert severity_from_kpis(utilization_pct=70) is Severity.WARNING
    assert severity_from_kpis(utilization_pct=92) is Severity.CRITICAL
    assert severity_from_kpis(dropped_call_rate_pct=1.99) is None
    assert severity_from_kpis(dropped_call_rate_pct=2) is Severity.WARNING
    assert severity_from_kpis(dropped_call_rate_pct=5) is Severity.CRITICAL


def test_kpi_worst_band_wins() -> None:
    assert (
        severity_from_kpis(latency_ms=80, utilization_pct=92, dropped_call_rate_pct=2)
        is Severity.CRITICAL
    )


def test_unknown_alarm_type_falls_back_to_source() -> None:
    computed, rule = compute_alarm_severity(
        source_severity=Severity.MINOR,
        alarm_code="NOT_A_REAL_CODE",
    )
    assert computed is Severity.MINOR
    assert rule == "source_fallback"


def test_alarm_code_map_does_not_override_source_field() -> None:
    computed, rule = compute_alarm_severity(
        source_severity=Severity.WARNING,
        alarm_code="SITE_UNREACHABLE",
    )
    assert computed is Severity.CRITICAL
    assert rule == "alarm_code_map"


def test_kpi_rule_conflicts_with_source_but_source_is_separate() -> None:
    computed, rule = compute_alarm_severity(
        source_severity=Severity.MAJOR,
        alarm_code="HIGH_LATENCY",
        latency_ms=200,
    )
    assert computed is Severity.CRITICAL
    assert rule == "kpi_threshold"


def test_concurrent_fingerprint_insert_keeps_one_row(data_dir: Path) -> None:
    repo = JsonOssRepository(data_dir)
    fingerprint = "SITE-001|HIGH_LATENCY|2026-10-22T15:00:00Z"
    payload = {
        "site_id": "SITE-001",
        "alarm_code": "HIGH_LATENCY",
        "severity": "major",
        "status": "active",
        "timestamp": "2026-10-22T15:00:00+00:00",
        "message": "concurrent",
    }
    errors: list[DuplicateAlarm] = []

    def insert() -> None:
        try:
            repo.add_alarm_record(dict(payload), fingerprint=fingerprint)
        except DuplicateAlarm as exc:
            errors.append(exc)

    threads = [Thread(target=insert), Thread(target=insert)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()
    assert len(errors) == 1
    matches = [
        row
        for row in repo.list_alarm_records()
        if row.get("timestamp") == "2026-10-22T15:00:00+00:00"
        and row.get("message") == "concurrent"
    ]
    assert len(matches) == 1

"""PostgreSQL-backed tests. Skipped unless TEST_DATABASE_URL is set.

Never point TEST_DATABASE_URL at a shared or production RDS instance.
"""

from __future__ import annotations

import os
from collections.abc import Generator
from datetime import UTC, datetime
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import inspect, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.models import (
    REQUIRED_TABLES,
    IncidentAlarmRow,
    NetworkAlarmRow,
    NetworkSiteRow,
)
from app.db.seed import count_rows, seed_database
from app.db.session import get_engine, get_session_factory, reset_engine
from app.utils.settings import get_settings
from app.utils.timestamps import parse_utc_datetime

TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL", "").strip()
pytestmark = pytest.mark.postgres

BACKEND_DIR = Path(__file__).resolve().parents[2]


def _require_test_db() -> str:
    if not TEST_DATABASE_URL:
        pytest.skip("TEST_DATABASE_URL is not set")
    return TEST_DATABASE_URL


@pytest.fixture
def postgres_session(monkeypatch: pytest.MonkeyPatch) -> Generator[Session, None, None]:
    url = _require_test_db()
    monkeypatch.setenv("DATABASE_URL", url)
    monkeypatch.delenv("DATABASE_DISABLED", raising=False)
    get_settings.cache_clear()
    reset_engine()
    _upgrade_head()
    factory = get_session_factory()
    assert factory is not None
    session = factory()
    try:
        _clear_tables(session)
        yield session
        session.rollback()
    finally:
        session.close()
        reset_engine()
        get_settings.cache_clear()


@pytest.fixture
def postgres_client(monkeypatch: pytest.MonkeyPatch, data_dir: Path) -> Generator[TestClient, None, None]:
    from app.api.deps import get_json_oss_repository
    from app.main import app

    url = _require_test_db()
    monkeypatch.setenv("DATABASE_URL", url)
    monkeypatch.delenv("DATABASE_DISABLED", raising=False)
    get_settings.cache_clear()
    get_json_oss_repository.cache_clear()
    reset_engine()
    _upgrade_head()
    factory = get_session_factory()
    assert factory is not None
    session = factory()
    try:
        _clear_tables(session)
        seed_database(session, data_dir)
        session.commit()
    except Exception:
        session.rollback()
        session.close()
        raise
    else:
        session.close()

    with TestClient(app) as test_client:
        yield test_client

    get_json_oss_repository.cache_clear()
    reset_engine()
    get_settings.cache_clear()


def _clear_tables(session: Session) -> None:
    session.execute(
        text(
            "TRUNCATE TABLE audit_events, remediation_actions, runbook_references, "
            "investigation_results, incident_alarms, incidents, deployments, "
            "telemetry_metrics, network_alarms, network_sites RESTART IDENTITY CASCADE"
        )
    )
    session.commit()


def _upgrade_head() -> None:
    from alembic import command
    from alembic.config import Config

    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    command.upgrade(config, "head")


def test_sqlalchemy_connects(postgres_session: Session) -> None:
    assert postgres_session.execute(text("SELECT 1")).scalar() == 1
    engine = get_engine()
    assert engine is not None


def test_alembic_creates_all_tables(postgres_session: Session) -> None:
    engine = get_engine()
    assert engine is not None
    names = set(inspect(engine).get_table_names())
    assert set(REQUIRED_TABLES) <= names
    assert "alembic_version" in names


def test_seed_inserts_expected_counts(postgres_session: Session, data_dir: Path) -> None:
    counts = seed_database(postgres_session, data_dir)
    postgres_session.commit()
    assert counts["network_sites"] == 20
    assert counts["network_alarms"] == 100
    assert counts["telemetry_metrics"] == 240
    assert counts["deployments"] == 6
    assert counts["incidents"] == 3
    assert counts["incident_alarms"] == 10
    assert counts["investigation_results"] == 3
    assert counts["remediation_actions"] == 4
    assert counts["audit_events"] >= 4
    assert counts["runbook_references"] >= 4


def test_seed_is_idempotent(postgres_session: Session, data_dir: Path) -> None:
    first = seed_database(postgres_session, data_dir)
    postgres_session.commit()
    second = seed_database(postgres_session, data_dir)
    postgres_session.commit()
    assert first == second == count_rows(postgres_session)


def test_seed_rolls_back_on_failure(postgres_session: Session, data_dir: Path) -> None:
    postgres_session.execute(text("DELETE FROM audit_events"))
    postgres_session.execute(text("DELETE FROM remediation_actions"))
    postgres_session.execute(text("DELETE FROM runbook_references"))
    postgres_session.execute(text("DELETE FROM investigation_results"))
    postgres_session.execute(text("DELETE FROM incident_alarms"))
    postgres_session.execute(text("DELETE FROM incidents"))
    postgres_session.execute(text("DELETE FROM deployments"))
    postgres_session.execute(text("DELETE FROM telemetry_metrics"))
    postgres_session.execute(text("DELETE FROM network_alarms"))
    postgres_session.execute(text("DELETE FROM network_sites"))
    postgres_session.commit()
    with pytest.raises(RuntimeError, match="injected seed failure"):
        seed_database(postgres_session, data_dir, fail_after="sites")
        postgres_session.commit()
    postgres_session.rollback()
    assert count_rows(postgres_session)["network_sites"] == 0


def test_unique_alarm_id_and_incident_alarm_pair(
    postgres_session: Session, data_dir: Path
) -> None:
    seed_database(postgres_session, data_dir)
    postgres_session.commit()
    site = postgres_session.scalar(select(NetworkSiteRow).limit(1))
    assert site is not None
    duplicate = NetworkAlarmRow(
        alarm_id="ALM-0001",
        site_id=site.id,
        alarm_code="SITE_UNREACHABLE",
        severity="critical",
        status="active",
        message="duplicate",
        occurred_at=datetime.now(UTC),
    )
    postgres_session.add(duplicate)
    with pytest.raises(IntegrityError):
        postgres_session.flush()
    postgres_session.rollback()

    existing = postgres_session.scalar(select(IncidentAlarmRow).limit(1))
    assert existing is not None
    postgres_session.add(
        IncidentAlarmRow(incident_id=existing.incident_id, alarm_id=existing.alarm_id)
    )
    with pytest.raises(IntegrityError):
        postgres_session.flush()
    postgres_session.rollback()


def test_timestamps_are_timezone_aware(postgres_session: Session, data_dir: Path) -> None:
    seed_database(postgres_session, data_dir)
    postgres_session.commit()
    alarm = postgres_session.scalar(select(NetworkAlarmRow).limit(1))
    assert alarm is not None
    assert alarm.occurred_at.tzinfo is not None
    assert alarm.occurred_at.utcoffset() is not None
    parsed = parse_utc_datetime(alarm.occurred_at.isoformat())
    assert parsed.tzinfo is UTC or parsed.utcoffset() == UTC.utcoffset(parsed)


def test_database_backed_alarm_filters_and_pagination(postgres_client: TestClient) -> None:
    response = postgres_client.get(
        "/alarms",
        params={"site_id": "SITE-003", "severity": "critical", "page_size": 2},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["total"] >= 1
    assert body["page_size"] == 2
    assert len(body["items"]) <= 2
    assert all(item["site_id"] == "SITE-003" for item in body["items"])
    created = postgres_client.post(
        "/alarms",
        json={
            "alarm_id": "ALM-9001",
            "site_id": "SITE-001",
            "alarm_code": "HIGH_LATENCY",
            "severity": "major",
            "status": "active",
            "timestamp": "2026-10-22T15:00:00+00:00",
            "message": "Database-backed ingest",
        },
    )
    assert created.status_code == 201
    duplicate = postgres_client.post(
        "/alarms",
        json={
            "alarm_id": "ALM-9001",
            "site_id": "SITE-001",
            "alarm_code": "HIGH_LATENCY",
            "severity": "major",
            "status": "active",
            "timestamp": "2026-10-22T15:00:00+00:00",
            "message": "Database-backed ingest",
        },
    )
    assert duplicate.status_code == 409


def test_database_backed_sites_and_incidents(postgres_client: TestClient) -> None:
    sites = postgres_client.get("/sites")
    assert sites.status_code == 200
    assert sites.json()["total"] == 20
    detail = postgres_client.get("/sites/SITE-003")
    assert detail.status_code == 200
    incidents = postgres_client.get("/incidents", params={"site_id": "SITE-003"})
    assert incidents.status_code == 200
    assert incidents.json()["total"] == 1
    assert incidents.json()["items"][0]["evidence_alarm_ids"]


def test_session_released_after_request(postgres_client: TestClient) -> None:
    postgres_client.get("/health")
    engine = get_engine()
    assert engine is not None
    assert engine.pool.checkedout() == 0


def test_health_reports_database_ok(postgres_client: TestClient) -> None:
    response = postgres_client.get("/health")
    assert response.status_code == 200
    assert response.json()["database"] == "ok"
    ready = postgres_client.get("/health/ready")
    assert ready.status_code == 200

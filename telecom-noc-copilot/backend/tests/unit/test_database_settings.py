from __future__ import annotations

import pytest

from app.utils.settings import ensure_psycopg_driver, get_settings, redact_database_url


def test_ensure_psycopg_driver_rewrites_plain_postgres_url() -> None:
    url = ensure_psycopg_driver("postgresql://noc_user:secret@localhost:5432/telecom_noc")
    assert url.startswith("postgresql+psycopg://")
    assert "secret" in url


def test_redact_database_url_strips_credentials() -> None:
    redacted = redact_database_url(
        "postgresql+psycopg://noc_user:local_dev_password@localhost:5432/telecom_noc"
    )
    assert "local_dev_password" not in redacted
    assert "noc_user" not in redacted
    assert "localhost" in redacted
    assert "telecom_noc" in redacted


def test_database_disabled_ignores_url(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_DISABLED", "true")
    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg://noc_user:x@localhost:5432/telecom_noc")
    get_settings.cache_clear()
    settings = get_settings()
    assert settings.resolved_database_url is None
    get_settings.cache_clear()

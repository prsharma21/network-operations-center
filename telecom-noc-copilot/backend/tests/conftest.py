from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.db.session import reset_engine
from app.main import app
from app.utils.settings import get_settings

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = PROJECT_ROOT / "data"


@pytest.fixture(scope="session")
def data_dir() -> Path:
    return DATA_DIR


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    from app.api.deps import get_json_oss_repository

    monkeypatch.setenv("DATABASE_DISABLED", "true")
    get_settings.cache_clear()
    get_json_oss_repository.cache_clear()
    reset_engine()
    with TestClient(app) as test_client:
        yield test_client
    get_json_oss_repository.cache_clear()
    get_settings.cache_clear()
    reset_engine()

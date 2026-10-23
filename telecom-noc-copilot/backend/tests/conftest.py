from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.utils.settings import get_settings

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = PROJECT_ROOT / "data"


@pytest.fixture(scope="session")
def data_dir() -> Path:
    return DATA_DIR


@pytest.fixture
def client() -> TestClient:
    from app.api.deps import (
        get_alarm_service,
        get_deployment_service,
        get_oss_repository,
        get_oss_service,
        get_telemetry_service,
        get_ticket_service,
    )

    factories = (
        get_oss_repository,
        get_oss_service,
        get_alarm_service,
        get_telemetry_service,
        get_deployment_service,
        get_ticket_service,
    )
    get_settings.cache_clear()
    for factory in factories:
        factory.cache_clear()
    with TestClient(app) as test_client:
        yield test_client
    for factory in factories:
        factory.cache_clear()

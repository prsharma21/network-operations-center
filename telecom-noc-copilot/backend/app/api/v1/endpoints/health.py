"""Liveness and database readiness endpoints."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from app.db.session import check_database
from app.schemas.health import HealthResponse, RootResponse
from app.utils.settings import get_settings

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
def get_health() -> HealthResponse:
    settings = get_settings()
    return HealthResponse(
        status="ok",
        service=settings.app_name,
        version=settings.app_version,
        environment=settings.app_env,
        database=check_database(),  # ok | disabled | unavailable
    )


@router.get("/health/ready")
def get_ready() -> dict[str, str]:
    """Readiness: 503 when DATABASE_URL is set but PostgreSQL is unreachable."""
    state = check_database()
    if state == "unavailable":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database is configured but unreachable",
        )
    return {"status": "ok", "database": state}


@router.get("/", response_model=RootResponse)
def get_root() -> RootResponse:
    settings = get_settings()
    return RootResponse(service=settings.app_title, version=settings.app_version)

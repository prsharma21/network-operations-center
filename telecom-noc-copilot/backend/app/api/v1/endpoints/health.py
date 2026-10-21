"""Liveness endpoints. No database or AWS calls."""

from __future__ import annotations

from fastapi import APIRouter

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
    )


@router.get("/", response_model=RootResponse)
def get_root() -> RootResponse:
    settings = get_settings()
    return RootResponse(service=settings.app_title, version=settings.app_version)

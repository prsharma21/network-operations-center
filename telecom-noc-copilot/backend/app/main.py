"""FastAPI application entry point for the Telecom NOC Copilot.

Day 3 plus Phase 1–4 mock OSS: sites, alarms, telemetry, deployments, and tickets.
PostgreSQL and Bedrock are not implemented here.
"""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.endpoints.alarms import router as alarms_router
from app.api.v1.endpoints.deployments import router as deployments_router
from app.api.v1.endpoints.health import router as health_router
from app.api.v1.endpoints.sites import router as sites_router
from app.api.v1.endpoints.telemetry import router as telemetry_router
from app.api.v1.endpoints.tickets import router as tickets_router
from app.api.v1.router import api_router
from app.utils.logging import configure_logging
from app.utils.settings import get_settings

logger = logging.getLogger("telecom_noc_copilot")


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    configure_logging(settings.log_level)
    logger.info(
        "Starting %s v%s env=%s cors=%s",
        settings.app_title,
        settings.app_version,
        settings.app_env,
        ",".join(settings.cors_origin_list),
    )
    yield
    logger.info("Shutting down %s", settings.app_title)


def create_app() -> FastAPI:
    settings = get_settings()
    application = FastAPI(
        title=settings.app_title,
        version=settings.app_version,
        description=(
            "Agentic AI Telecom Network Operations Center Copilot API. "
            "Mock OSS exposes site lookup, alarms, telemetry, GET /deployments, "
            "and GET /tickets from synthetic JSON. No live network actions are performed."
        ),
        lifespan=lifespan,
    )
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["*"],
    )
    application.include_router(health_router)
    application.include_router(sites_router)
    application.include_router(alarms_router)
    application.include_router(telemetry_router)
    application.include_router(deployments_router)
    application.include_router(tickets_router)
    application.include_router(api_router)
    return application


app = create_app()

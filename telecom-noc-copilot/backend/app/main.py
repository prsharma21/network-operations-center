"""FastAPI application entry point for the Telecom NOC Copilot.

Day 3 scope: Pydantic request/response validation, configuration, CORS, and
liveness. PostgreSQL, Bedrock, and CRUD collection APIs are not implemented here.
"""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.endpoints.health import router as health_router
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
            "Day 3 exposes request/response validation and a health check. "
            "No live network actions are performed."
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
    application.include_router(api_router)
    return application


app = create_app()

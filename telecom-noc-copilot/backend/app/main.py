"""FastAPI application entry point for the Telecom NOC Copilot.

Mock OSS: sites, alarms, telemetry, deployments, tickets, and incidents.
When DATABASE_URL is set, relational data is served from PostgreSQL; otherwise
the synthetic JSON fixtures remain the source of truth. Tickets, equipment, and
topology stay on JSON. No live network actions are performed.
"""

from __future__ import annotations

import logging
import uuid
from collections.abc import AsyncIterator, Callable
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from app.api.v1.endpoints.alarms import router as alarms_router
from app.api.v1.endpoints.deployments import router as deployments_router
from app.api.v1.endpoints.health import router as health_router
from app.api.v1.endpoints.incidents import router as incidents_router
from app.api.v1.endpoints.sites import router as sites_router
from app.api.v1.endpoints.telemetry import router as telemetry_router
from app.api.v1.endpoints.tickets import router as tickets_router
from app.api.v1.router import api_router
from app.db.session import reset_engine
from app.utils.logging import configure_logging, log_structured
from app.utils.settings import get_settings, redact_database_url

logger = logging.getLogger("telecom_noc_copilot")
alarm_logger = logging.getLogger("telecom_noc_copilot.alarms")


class RequestIdMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    configure_logging(settings.log_level)
    database_target = (
        redact_database_url(settings.resolved_database_url)
        if settings.resolved_database_url
        else "json-fixtures"
    )
    logger.info(
        "Starting %s v%s env=%s cors=%s database=%s",
        settings.app_title,
        settings.app_version,
        settings.app_env,
        ",".join(settings.cors_origin_list),
        database_target,
    )
    yield
    reset_engine()
    logger.info("Shutting down %s", settings.app_title)


def create_app() -> FastAPI:
    settings = get_settings()
    application = FastAPI(
        title=settings.app_title,
        version=settings.app_version,
        description=(
            "Agentic AI Telecom Network Operations Center Copilot API. "
            "Mock OSS exposes sites, alarms, telemetry, deployments, tickets, and "
            "incidents. PostgreSQL is used when DATABASE_URL is set. "
            "No live network actions are performed."
        ),
        lifespan=lifespan,
    )
    application.add_middleware(RequestIdMiddleware)
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
    application.include_router(incidents_router)
    application.include_router(api_router)

    @application.exception_handler(RequestValidationError)
    async def log_alarm_validation_error(
        request: Request,
        exc: RequestValidationError,
    ) -> JSONResponse:
        if request.method == "POST" and request.url.path.rstrip("/") == "/alarms":
            log_structured(
                alarm_logger,
                "alarm_ingest",
                request_id=getattr(request.state, "request_id", None),
                validation="failed",
                outcome="validation_failed",
                error_category="validation",
                error_count=len(exc.errors()),
            )
        return JSONResponse(
            status_code=422,
            content={"detail": jsonable_encoder(exc.errors())},
        )

    @application.exception_handler(SQLAlchemyError)
    async def database_error(_request: Request, _exc: SQLAlchemyError) -> JSONResponse:
        log_structured(logger, "database_error", outcome="error", error_category="database")
        return JSONResponse(
            status_code=500,
            content={"detail": "A database error occurred"},
        )

    return application


app = create_app()

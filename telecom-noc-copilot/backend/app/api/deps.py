"""Shared FastAPI dependencies for mock OSS services and database sessions."""

from __future__ import annotations

from collections.abc import Generator
from functools import lru_cache
from typing import Annotated, Any

from fastapi import Depends

from app.utils.settings import get_settings
from oss_api.alarm_service import OssAlarmService
from oss_api.deployment_service import OssDeploymentService
from oss_api.incident_service import OssIncidentService
from oss_api.repository import JsonOssRepository, OssDataRepository
from oss_api.service import OssSiteService
from oss_api.telemetry_service import OssTelemetryService
from oss_api.ticket_service import OssTicketService


def get_db_session() -> Generator[Any, None, None]:
    try:
        from app.db.session import yield_session
    except ImportError:
        yield None
        return
    yield from yield_session()


@lru_cache
def get_json_oss_repository() -> JsonOssRepository:
    return JsonOssRepository(get_settings().data_dir)


def get_oss_repository(
    db: Annotated[Any, Depends(get_db_session)],
) -> OssDataRepository:
    json_repo = get_json_oss_repository()
    if db is None:
        return json_repo
    from app.db.oss_repository import SqlAlchemyOssRepository

    return SqlAlchemyOssRepository(db, inventory=json_repo)


def get_oss_service(
    repo: Annotated[OssDataRepository, Depends(get_oss_repository)],
) -> OssSiteService:
    return OssSiteService(repo)


def get_alarm_service(
    repo: Annotated[OssDataRepository, Depends(get_oss_repository)],
) -> OssAlarmService:
    return OssAlarmService(repo)


def get_telemetry_service(
    repo: Annotated[OssDataRepository, Depends(get_oss_repository)],
) -> OssTelemetryService:
    return OssTelemetryService(repo)


def get_deployment_service(
    repo: Annotated[OssDataRepository, Depends(get_oss_repository)],
) -> OssDeploymentService:
    return OssDeploymentService(repo)


def get_ticket_service(
    repo: Annotated[OssDataRepository, Depends(get_oss_repository)],
) -> OssTicketService:
    return OssTicketService(repo)


def get_incident_service(
    repo: Annotated[OssDataRepository, Depends(get_oss_repository)],
) -> OssIncidentService:
    return OssIncidentService(repo)

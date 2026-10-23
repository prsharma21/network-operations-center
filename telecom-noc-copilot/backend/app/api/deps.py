"""Shared FastAPI dependencies for mock OSS services."""

from __future__ import annotations

from functools import lru_cache

from app.utils.settings import get_settings
from oss_api.alarm_service import OssAlarmService
from oss_api.deployment_service import OssDeploymentService
from oss_api.repository import JsonOssRepository
from oss_api.service import OssSiteService
from oss_api.telemetry_service import OssTelemetryService
from oss_api.ticket_service import OssTicketService


@lru_cache
def get_oss_repository() -> JsonOssRepository:
    return JsonOssRepository(get_settings().data_dir)


@lru_cache
def get_oss_service() -> OssSiteService:
    return OssSiteService(get_oss_repository())


@lru_cache
def get_alarm_service() -> OssAlarmService:
    return OssAlarmService(get_oss_repository())


@lru_cache
def get_telemetry_service() -> OssTelemetryService:
    return OssTelemetryService(get_oss_repository())


@lru_cache
def get_deployment_service() -> OssDeploymentService:
    return OssDeploymentService(get_oss_repository())


@lru_cache
def get_ticket_service() -> OssTicketService:
    return OssTicketService(get_oss_repository())

"""Health-check response schema."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common import MODEL_CONFIG, NonEmptyStr


class HealthResponse(BaseModel):
    model_config = MODEL_CONFIG

    status: Literal["ok"] = "ok"
    service: NonEmptyStr
    version: NonEmptyStr
    environment: NonEmptyStr


class RootResponse(BaseModel):
    model_config = MODEL_CONFIG

    service: NonEmptyStr
    version: NonEmptyStr
    health: str = Field(default="/health")
    docs: str = Field(default="/docs")
    openapi: str = Field(default="/openapi.json")

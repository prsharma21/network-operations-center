"""Environment-based settings for diagnostic tools.

Reads ``telecom-noc-copilot/.env`` when present. Never logs secrets.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_PROJECT_ROOT = Path(__file__).resolve().parents[1]
_ENV_FILE = _PROJECT_ROOT / ".env"


class AgentSettings(BaseSettings):
    """Runtime settings for the diagnostic tool HTTP client."""

    model_config = SettingsConfigDict(
        env_file=_ENV_FILE if _ENV_FILE.exists() else None,
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
        populate_by_name=True,
    )

    noc_api_base_url: str = Field(
        default="http://localhost:8000",
        validation_alias="NOC_API_BASE_URL",
    )
    noc_api_connect_timeout: float = Field(
        default=5.0,
        ge=0.1,
        le=60.0,
        validation_alias="NOC_API_CONNECT_TIMEOUT",
    )
    noc_api_read_timeout: float = Field(
        default=15.0,
        ge=0.1,
        le=120.0,
        validation_alias="NOC_API_READ_TIMEOUT",
    )
    noc_tool_max_results: int = Field(
        default=100,
        ge=1,
        le=200,
        validation_alias="NOC_TOOL_MAX_RESULTS",
    )
    log_level: str = Field(default="INFO", validation_alias="LOG_LEVEL")
    aws_region: str = Field(default="us-east-1", validation_alias="AWS_REGION")
    bedrock_model_id: str = Field(default="", validation_alias="BEDROCK_MODEL_ID")

    @field_validator("noc_api_base_url", mode="before")
    @classmethod
    def _strip_trailing_slash(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip().rstrip("/") or "http://localhost:8000"
        return value

    @field_validator("bedrock_model_id", "aws_region", mode="before")
    @classmethod
    def _strip_optional(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip()
        return value


@lru_cache
def get_agent_settings() -> AgentSettings:
    return AgentSettings()

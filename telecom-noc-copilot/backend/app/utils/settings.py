"""Environment-based application settings.

Reads the same variable names as ``telecom-noc-copilot/.env.example``.
PostgreSQL, Bedrock, and other later-stage secrets are ignored here.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/app/utils/settings.py -> telecom-noc-copilot/
_PROJECT_ROOT = Path(__file__).resolve().parents[3]
_ENV_FILE = _PROJECT_ROOT / ".env"


class Settings(BaseSettings):
    """Runtime settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=_ENV_FILE if _ENV_FILE.exists() else None,
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    app_name: str = "telecom-noc-copilot"
    app_title: str = "Telecom NOC Copilot API"
    app_version: str = "0.1.0"
    app_env: str = "development"
    log_level: str = "INFO"
    backend_host: str = "127.0.0.1"
    backend_port: int = 8000
    cors_origins: str = Field(default="http://localhost:5173")

    @property
    def cors_origin_list(self) -> list[str]:
        origins = [item.strip() for item in self.cors_origins.split(",") if item.strip()]
        if not origins:
            origins = ["http://localhost:5173"]
        if origins == ["*"] and self.app_env.lower() not in {"development", "dev", "local"}:
            raise ValueError(
                "Unrestricted CORS (CORS_ORIGINS=*) is not allowed outside development."
            )
        return origins

    @property
    def is_development(self) -> bool:
        return self.app_env.lower() in {"development", "dev", "local"}


@lru_cache
def get_settings() -> Settings:
    return Settings()

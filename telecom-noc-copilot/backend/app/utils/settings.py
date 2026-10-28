"""Environment-based application settings.

Reads the same variable names as ``telecom-noc-copilot/.env.example``.
A single SQLAlchemy stack uses ``DATABASE_URL`` for local Docker PostgreSQL
and AWS RDS. Extra env vars (Bedrock, S3, MCP) are ignored here.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from urllib.parse import quote_plus, urlparse, urlunparse

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/app/utils/settings.py -> telecom-noc-copilot/
_PROJECT_ROOT = Path(__file__).resolve().parents[3]
_ENV_FILE = _PROJECT_ROOT / ".env"

_VERIFY_SSL_MODES = frozenset({"verify-ca", "verify-full"})


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

    database_disabled: bool = False
    database_url: str | None = None
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_db: str = "telecom_noc"
    postgres_user: str = "noc_user"
    postgres_password: str | None = None
    database_ssl_mode: str = "prefer"
    database_ssl_root_cert: str | None = None
    database_secret_arn: str | None = None
    aws_region: str = "us-east-1"

    @field_validator(
        "database_url",
        "postgres_password",
        "database_ssl_root_cert",
        "database_secret_arn",
        mode="before",
    )
    @classmethod
    def _blank_to_none(cls, value: object) -> object:
        if isinstance(value, str) and not value.strip():
            return None
        return value

    @field_validator("database_ssl_mode", mode="before")
    @classmethod
    def _normalize_ssl_mode(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip().lower() or "prefer"
        return value

    @property
    def data_dir(self) -> Path:
        return _PROJECT_ROOT / "data"

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

    @property
    def database_configured(self) -> bool:
        return bool(self.resolved_database_url)

    @property
    def resolved_database_url(self) -> str | None:
        """SQLAlchemy URL for local Docker or RDS. None keeps JSON mock persistence."""
        if self.database_disabled:
            return None
        if self.database_url:
            return ensure_psycopg_driver(self.database_url)
        if self.database_secret_arn:
            from app.db.secrets import database_url_from_secret

            return ensure_psycopg_driver(
                database_url_from_secret(self.database_secret_arn, self.aws_region)
            )
        if self.postgres_password:
            user = quote_plus(self.postgres_user)
            password = quote_plus(self.postgres_password)
            host = self.postgres_host.strip()
            db_name = self.postgres_db.strip()
            return (
                f"postgresql+psycopg://{user}:{password}@{host}:{self.postgres_port}/{db_name}"
            )
        return None

    def engine_connect_args(self) -> dict[str, str]:
        mode = self.database_ssl_mode
        if mode in _VERIFY_SSL_MODES and not self.database_ssl_root_cert:
            raise ValueError(
                "DATABASE_SSL_ROOT_CERT is required when DATABASE_SSL_MODE is "
                f"{mode}. Do not disable certificate verification."
            )
        args: dict[str, str] = {}
        if mode and mode != "disable":
            args["sslmode"] = mode
        if self.database_ssl_root_cert:
            args["sslrootcert"] = self.database_ssl_root_cert
        return args


def ensure_psycopg_driver(url: str) -> str:
    """Use the psycopg (v3) driver without changing host, database, or credentials."""
    trimmed = url.strip()
    if trimmed.startswith("postgresql+psycopg://"):
        return trimmed
    if trimmed.startswith("postgresql+psycopg2://"):
        return "postgresql+psycopg://" + trimmed[len("postgresql+psycopg2://") :]
    if trimmed.startswith("postgresql://"):
        return "postgresql+psycopg://" + trimmed[len("postgresql://") :]
    if trimmed.startswith("postgres://"):
        return "postgresql+psycopg://" + trimmed[len("postgres://") :]
    return trimmed


def redact_database_url(url: str) -> str:
    """Host/db only — never return credentials."""
    parsed = urlparse(url)
    host = parsed.hostname or "localhost"
    port = f":{parsed.port}" if parsed.port else ""
    database = parsed.path or ""
    return f"{parsed.scheme}://{host}{port}{database}"


def database_location(url: str) -> str:
    parsed = urlparse(url)
    return urlunparse(("", "", parsed.hostname or "", "", "", "")).strip("/") or "localhost"


@lru_cache
def get_settings() -> Settings:
    return Settings()

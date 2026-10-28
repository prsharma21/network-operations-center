"""SQLAlchemy engine and session factories.

A session is created per request and closed in ``finally``. Importing this
module does not connect to PostgreSQL until ``get_engine()`` is called.
"""

from __future__ import annotations

import logging
import threading
from collections.abc import Generator
from typing import Literal

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.utils.settings import get_settings, redact_database_url

logger = logging.getLogger("telecom_noc_copilot.db")

_lock = threading.Lock()
_engine: Engine | None = None
_session_factory: sessionmaker[Session] | None = None


def get_engine() -> Engine | None:
    """Return the shared engine, or None when JSON mock persistence is in use."""
    global _engine, _session_factory
    settings = get_settings()
    url = settings.resolved_database_url
    if not url:
        return None
    if _engine is not None:
        return _engine
    with _lock:
        if _engine is not None:
            return _engine
        connect_args = settings.engine_connect_args()
        _engine = create_engine(
            url,
            pool_pre_ping=True,
            pool_size=5,
            max_overflow=10,
            pool_recycle=1800,
            connect_args=connect_args,
        )
        _session_factory = sessionmaker(
            bind=_engine,
            autoflush=False,
            autocommit=False,
            expire_on_commit=False,
        )
        logger.info("SQLAlchemy engine created target=%s", redact_database_url(url))
        return _engine


def get_session_factory() -> sessionmaker[Session] | None:
    if get_engine() is None:
        return None
    return _session_factory


def get_alembic_url() -> str:
    url = get_settings().resolved_database_url
    if not url:
        raise RuntimeError(
            "DATABASE_URL is not set. Configure local Docker PostgreSQL or an RDS endpoint."
        )
    return url


def reset_engine() -> None:
    """Dispose the cached engine. Used by tests when DATABASE_URL changes."""
    global _engine, _session_factory
    with _lock:
        if _engine is not None:
            _engine.dispose()
        _engine = None
        _session_factory = None


def check_database() -> Literal["ok", "disabled", "unavailable"]:
    """Return ``ok``, ``disabled``, or ``unavailable``. Never includes credentials."""
    engine = get_engine()
    if engine is None:
        return "disabled"
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return "ok"
    except Exception:
        logger.warning("Database health check failed", exc_info=False)
        return "unavailable"


def yield_session() -> Generator[Session | None, None, None]:
    factory = get_session_factory()
    if factory is None:
        yield None
        return
    session = factory()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()

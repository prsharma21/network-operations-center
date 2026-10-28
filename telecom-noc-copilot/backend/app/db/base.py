"""Shared SQLAlchemy 2.x declarative base.

Schema changes are applied only by Alembic migrations. Importing this module
does not create tables or seed rows.
"""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Declarative base for all telecom NOC tables."""

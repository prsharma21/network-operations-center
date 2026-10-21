"""Shared Pydantic field types."""

from __future__ import annotations

from typing import Annotated

from pydantic import AfterValidator, ConfigDict, Field

from app.utils.timestamps import UtcDateTime

__all__ = ["MODEL_CONFIG", "NonEmptyStr", "SiteId", "UtcDateTime"]

MODEL_CONFIG = ConfigDict(
    extra="forbid",
    populate_by_name=True,
    str_strip_whitespace=True,
    use_enum_values=False,
)


def _require_non_blank(value: str) -> str:
    stripped = value.strip()
    if not stripped:
        raise ValueError("must not be blank")
    return stripped


NonEmptyStr = Annotated[str, AfterValidator(_require_non_blank)]
SiteId = Annotated[NonEmptyStr, Field(examples=["SITE-003"])]

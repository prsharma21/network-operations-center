"""Application logging. Never log credentials or secret values."""

from __future__ import annotations

import logging

_SECRET_FRAGMENTS = ("password", "secret", "token", "key", "credential", "arn")


def configure_logging(level: str) -> None:
    logging.basicConfig(
        level=getattr(logging, level.upper(), logging.INFO),
        format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
        force=True,
    )
    logging.captureWarnings(True)


def is_secret_name(name: str) -> bool:
    lowered = name.lower()
    return any(fragment in lowered for fragment in _SECRET_FRAGMENTS)


def log_structured(logger: logging.Logger, event: str, **fields: object) -> None:
    """Log ``event=... key=value`` pairs. Skips secrets and None values."""
    parts = [f"event={event}"]
    for key, value in fields.items():
        if value is None or is_secret_name(key):
            continue
        parts.append(f"{key}={value}")
    logger.info(" ".join(parts))

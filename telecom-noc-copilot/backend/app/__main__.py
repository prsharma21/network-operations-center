"""Run with ``python -m app`` from the backend directory."""

from __future__ import annotations

import uvicorn

from app.utils.settings import get_settings


def main() -> None:
    settings = get_settings()
    uvicorn.run(
        "app.main:app",
        host=settings.backend_host,
        port=settings.backend_port,
        reload=settings.is_development,
    )


if __name__ == "__main__":
    main()

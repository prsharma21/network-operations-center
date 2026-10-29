"""Run with ``python -m app`` from the backend directory."""

from __future__ import annotations

from pathlib import Path

import uvicorn

from app.utils.settings import get_settings

_BACKEND_DIR = Path(__file__).resolve().parents[1]
_MOCK_SERVICES = _BACKEND_DIR.parent / "mock-services"


def main() -> None:
    settings = get_settings()
    uvicorn.run(
        "app.main:app",
        host=settings.backend_host,
        port=settings.backend_port,
        reload=settings.is_development,
        reload_dirs=[str(_BACKEND_DIR / "app"), str(_MOCK_SERVICES)],
    )


if __name__ == "__main__":
    main()

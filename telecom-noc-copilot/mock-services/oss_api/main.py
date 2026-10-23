"""Standalone mock OSS API.

Run from ``telecom-noc-copilot`` after installing backend requirements:

    uvicorn oss_api.main:app --app-dir mock-services --host 127.0.0.1 --port 9001
"""

from __future__ import annotations

import sys
from pathlib import Path

_BACKEND_DIR = Path(__file__).resolve().parents[2] / "backend"
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

from fastapi import FastAPI  # noqa: E402

from app.api.v1.endpoints.sites import router as sites_router  # noqa: E402

app = FastAPI(
    title="Mock OSS Site API",
    version="0.1.0",
    description="Synthetic OSS site configuration. No live network actions.",
)
app.include_router(sites_router)

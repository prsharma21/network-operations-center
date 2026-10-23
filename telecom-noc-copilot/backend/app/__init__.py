"""Telecom NOC Copilot FastAPI application package."""

from __future__ import annotations

import sys
from pathlib import Path

# mock-services/oss_api is a sibling package of backend/. Pytest adds it via
# pythonpath; uvicorn does not, so register it here for app startup.
_MOCK_SERVICES = Path(__file__).resolve().parents[2] / "mock-services"
if _MOCK_SERVICES.is_dir() and str(_MOCK_SERVICES) not in sys.path:
    sys.path.insert(0, str(_MOCK_SERVICES))

__version__ = "0.1.0"

from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "backend"
MOCK = ROOT / "mock-services"
for path in (ROOT, BACKEND, MOCK):
    text = str(path)
    if text not in sys.path:
        sys.path.insert(0, text)


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"

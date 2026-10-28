"""Seed the telecom NOC PostgreSQL database from synthetic JSON fixtures.

Run from telecom-noc-copilot/backend:

    python -m app.db.seed --counts
"""

from __future__ import annotations

import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1] / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from app.db.seed import main

if __name__ == "__main__":
    raise SystemExit(main())

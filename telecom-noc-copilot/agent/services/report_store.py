"""Local report persistence for Day 20.

Writes the investigation report to ``data/reports`` so a later GET can reload
it. When ``REPORT_S3_BUCKET`` is set, the same JSON is uploaded and the object
key is recorded. A missing bucket or a failed upload keeps the local file.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

_PROJECT_ROOT = Path(__file__).resolve().parents[2]


class ReportStore:
    def __init__(self, directory: Path) -> None:
        self.directory = directory

    def save(self, report: dict[str, Any]) -> dict[str, Any]:
        incident_id = str(report.get("incident_id") or "UNKNOWN")
        stored = dict(report)
        self.directory.mkdir(parents=True, exist_ok=True)
        path = self.directory / f"{incident_id}.json"
        path.write_text(json.dumps(stored, indent=2), encoding="utf-8")
        stored["storage_uri"] = path.resolve().as_uri()
        stored["storage_backend"] = "local_file"
        object_key = _upload_s3(path, incident_id)
        if object_key:
            stored["s3_key"] = object_key
            stored["storage_backend"] = "s3"
        path.write_text(json.dumps(stored, indent=2), encoding="utf-8")
        return stored

    def get(self, incident_id: str) -> dict[str, Any] | None:
        path = self.directory / f"{incident_id}.json"
        if not path.exists():
            return None
        payload = json.loads(path.read_text(encoding="utf-8"))
        return payload if isinstance(payload, dict) else None


def get_report_store() -> ReportStore:
    raw = os.environ.get("REPORT_STORE_DIR", "").strip()
    directory = Path(raw) if raw else _PROJECT_ROOT / "data" / "reports"
    return ReportStore(directory)


def _upload_s3(path: Path, incident_id: str) -> str | None:
    bucket = os.environ.get("REPORT_S3_BUCKET", "").strip()
    if not bucket:
        return None
    key = f"reports/{incident_id}.json"
    try:
        import boto3
    except ImportError:
        return None
    try:
        boto3.client("s3").upload_file(str(path), bucket, key)
    except Exception:
        return None
    return key

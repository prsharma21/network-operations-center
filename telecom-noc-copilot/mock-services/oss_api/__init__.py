"""Mock OSS site-configuration API backed by synthetic JSON.

This package is the JSON data-access layer for Phase 1. A later PostgreSQL
repository can implement the same ``SiteRepository`` protocol without changing
the FastAPI route.
"""

from oss_api.exceptions import InvalidStoredSite, SiteNotFound
from oss_api.repository import JsonOssRepository, SiteRepository
from oss_api.service import OssSiteService

__all__ = [
    "InvalidStoredSite",
    "JsonOssRepository",
    "OssSiteService",
    "SiteNotFound",
    "SiteRepository",
]

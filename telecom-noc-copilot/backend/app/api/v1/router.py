from __future__ import annotations

from fastapi import APIRouter

from app.api.v1.endpoints import validation

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(validation.router)

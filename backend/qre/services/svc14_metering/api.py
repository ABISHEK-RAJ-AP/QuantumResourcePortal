"""Metering rollups API (API-MTR-01)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from fastapi.responses import PlainTextResponse
from sqlalchemy.ext.asyncio import AsyncSession

from qre.core.context import TenantContext
from qre.core.deps import db_session, require_permission
from qre.services.svc14_metering import service as svc

router = APIRouter(tags=["metering"])


@router.get("/meter-rollups")
async def meter_rollups(
    ctx: TenantContext = Depends(require_permission("usage:read")),
    session: AsyncSession = Depends(db_session),
    hours: int = Query(24),
) -> dict:
    return await svc.meter_rollups(session, ctx, hours=hours)


@router.get("/meter-rollups/export")
async def meter_rollups_export(
    ctx: TenantContext = Depends(require_permission("report:export")),
    session: AsyncSession = Depends(db_session),
    hours: int = Query(24),
) -> PlainTextResponse:
    csv_text = await svc.meter_rollups_csv(session, ctx, hours=hours)
    return PlainTextResponse(csv_text, media_type="text/csv")
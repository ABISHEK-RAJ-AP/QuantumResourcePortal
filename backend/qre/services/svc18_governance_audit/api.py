"""Governance audit events (reads audit_log)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from fastapi.responses import PlainTextResponse
from sqlalchemy.ext.asyncio import AsyncSession

from qre.core.context import TenantContext
from qre.core.deps import db_session, require_permission
from qre.services.svc18_governance_audit import service as svc

router = APIRouter(tags=["governance-audit"])


@router.get("/governance/audit-events")
async def list_audit_events(
    ctx: TenantContext = Depends(require_permission("audit:read")),
    session: AsyncSession = Depends(db_session),
    limit: int = Query(100, ge=1, le=500),
    action_prefix: str | None = Query(None),
) -> dict:
    return await svc.list_audit_events(
        session, ctx, limit=limit, action_prefix=action_prefix
    )


@router.get("/governance/audit-events/export")
async def export_audit_events(
    ctx: TenantContext = Depends(require_permission("audit:export")),
    session: AsyncSession = Depends(db_session),
    limit: int = Query(500, ge=1, le=2000),
    action_prefix: str | None = Query(None),
) -> PlainTextResponse:
    csv_text = await svc.export_audit_events_csv(
        session, ctx, limit=limit, action_prefix=action_prefix
    )
    return PlainTextResponse(csv_text, media_type="text/csv")
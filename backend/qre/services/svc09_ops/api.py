"""Operations centre and governance activity feeds."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from qre.core.context import TenantContext
from qre.core.deps import db_session, require_permission
from qre.services.svc09_ops import service as svc

router = APIRouter(tags=["operations"])


@router.get("/operations/centre")
async def operations_centre(
    ctx: TenantContext = Depends(require_permission("governance:read")),
    session: AsyncSession = Depends(db_session),
) -> dict:
    return await svc.operations_centre(session, ctx)


@router.get("/governance/activity")
async def governance_activity(
    ctx: TenantContext = Depends(require_permission("governance:read")),
    session: AsyncSession = Depends(db_session),
    limit: int = Query(8, ge=1, le=200),
    project_id: str | None = Query(None),
) -> dict:
    return await svc.governance_activity(session, ctx, limit=limit, project_id=project_id)
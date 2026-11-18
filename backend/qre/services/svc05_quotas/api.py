"""Quota ledger and evaluation (API-QUO-01)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from qre.core.context import TenantContext
from qre.core.deps import db_session, require_permission
from qre.services.svc05_quotas import service as svc

router = APIRouter(tags=["quotas"])


@router.get("/quotas/ledger")
async def quotas_ledger(
    ctx: TenantContext = Depends(require_permission("quota:read")),
    session: AsyncSession = Depends(db_session),
    window: str = Query("today"),
    project_id: str | None = Query(None),
) -> dict:
    return await svc.get_ledger(session, ctx, window=window, project_id=project_id)


@router.get("/quotas/evaluate")
async def quotas_evaluate(
    ctx: TenantContext = Depends(require_permission("quota:read")),
    session: AsyncSession = Depends(db_session),
    workload_id: str = Query(..., min_length=26, max_length=26),
) -> dict:
    return await svc.evaluate_workload(session, ctx, workload_id=workload_id)
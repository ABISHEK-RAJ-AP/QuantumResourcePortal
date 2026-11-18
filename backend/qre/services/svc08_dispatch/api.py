"""Dispatch and provider jobs API (API-EXE-01–03)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from qre.core.context import TenantContext
from qre.core.deps import db_session, get_ctx, require_permission
from qre.services.svc08_dispatch import service as svc
from qre.services.svc08_dispatch.schemas import AuthorizeDispatchIn, ReconcileIn, RecordAttemptIn

router = APIRouter(tags=["dispatch"])


@router.get("/dispatch-icd")
async def dispatch_icd(
    ctx: TenantContext = Depends(require_permission("dispatch:read")),
) -> dict:
    return await svc.dispatch_icd(ctx)


@router.get("/dispatch-attempts")
async def list_dispatch_attempts(
    ctx: TenantContext = Depends(require_permission("dispatch:read")),
    session: AsyncSession = Depends(db_session),
) -> dict:
    return await svc.list_attempts(session, ctx)


@router.post("/dispatch-attempts/{attempt_id}/reconcile")
async def reconcile_dispatch_attempt(
    attempt_id: str,
    body: ReconcileIn,
    ctx: TenantContext = Depends(get_ctx),
    session: AsyncSession = Depends(db_session),
) -> dict:
    return await svc.reconcile_attempt(
        session, ctx, attempt_id, outcome=body.outcome, reason=body.reason
    )


@router.get("/jobs")
async def list_jobs(
    ctx: TenantContext = Depends(require_permission("dispatch:read")),
    session: AsyncSession = Depends(db_session),
    limit: int = Query(50, ge=1, le=200),
) -> dict:
    return await svc.list_jobs(session, ctx, limit=limit)


@router.get("/jobs/{job_id}")
async def get_job(
    job_id: str,
    ctx: TenantContext = Depends(require_permission("dispatch:read")),
    session: AsyncSession = Depends(db_session),
) -> dict:
    return await svc.get_job(session, ctx, job_id)


@router.post("/workloads/{workload_id}/authorize-dispatch")
async def authorize_dispatch(
    workload_id: str,
    body: AuthorizeDispatchIn,
    ctx: TenantContext = Depends(get_ctx),
    session: AsyncSession = Depends(db_session),
) -> dict:
    return await svc.authorize_dispatch(
        session, ctx, workload_id, backend_id=body.backend_id
    )


@router.post("/workloads/{workload_id}/dispatch-attempts")
async def record_dispatch_attempt(
    workload_id: str,
    body: RecordAttemptIn,
    ctx: TenantContext = Depends(get_ctx),
    session: AsyncSession = Depends(db_session),
) -> dict:
    return await svc.record_attempt(
        session,
        ctx,
        workload_id,
        backend_id=body.backend_id,
        execution_class=body.execution_class,
        external_job_id=body.external_job_id,
    )
"""Workload submissions and approval queue."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.ext.asyncio import AsyncSession

from qre.core.context import TenantContext
from qre.core.deps import db_session, get_ctx, require_permission
from qre.services.svc06_approvals import service as svc

router = APIRouter(tags=["approvals"])


class WorkloadSubmissionIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    project_id: str = Field(min_length=26, max_length=26)
    metadata: dict[str, str] = Field(default_factory=dict)


class DecideIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    decision: str = Field(pattern=r"^(approve|reject|changes_requested)$")
    comment: str = Field(default="", max_length=2000)
    expected_stage_id: str | None = Field(default=None, max_length=64)


class WithdrawIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    comment: str = Field(default="", max_length=2000)


@router.post("/workload-submissions", status_code=201)
async def create_submission(
    body: WorkloadSubmissionIn,
    ctx: TenantContext = Depends(require_permission("workload:create")),
    session: AsyncSession = Depends(db_session),
) -> dict:
    return await svc.create_submission(
        session, ctx, project_id=body.project_id, metadata=body.metadata or None
    )


@router.post("/workload-submissions/{submission_id}/submit-for-review")
async def submit_for_review(
    submission_id: str,
    ctx: TenantContext = Depends(require_permission("workload:submit")),
    session: AsyncSession = Depends(db_session),
) -> dict:
    return await svc.submit_for_review(session, ctx, submission_id)


@router.get("/approvals")
async def list_approvals(
    ctx: TenantContext = Depends(require_permission("approval:read")),
    session: AsyncSession = Depends(db_session),
    project_id: str | None = None,
    state: str | None = None,
    scope: str | None = None,
) -> dict:
    return {
        "items": await svc.list_approvals(
            session, ctx, project_id=project_id, state=state, scope=scope
        )
    }


@router.get("/approvals/{workload_id}")
async def get_approval(
    workload_id: str,
    ctx: TenantContext = Depends(get_ctx),
    session: AsyncSession = Depends(db_session),
) -> dict:
    return await svc.get_approval(session, ctx, workload_id)


@router.post("/approvals/{workload_id}/decide")
async def decide(
    workload_id: str,
    body: DecideIn,
    ctx: TenantContext = Depends(require_permission("approval:decide")),
    session: AsyncSession = Depends(db_session),
) -> dict:
    return await svc.decide(
        session,
        ctx,
        workload_id,
        decision=body.decision,
        comment=body.comment,
        expected_stage_id=body.expected_stage_id,
    )


@router.post("/approvals/{workload_id}/withdraw")
async def withdraw(
    workload_id: str,
    body: WithdrawIn,
    ctx: TenantContext = Depends(require_permission("workload:withdraw")),
    session: AsyncSession = Depends(db_session),
) -> dict:
    return await svc.withdraw(session, ctx, workload_id, comment=body.comment)


@router.get("/governance/summary")
async def governance_summary(
    ctx: TenantContext = Depends(require_permission("governance:read")),
    session: AsyncSession = Depends(db_session),
) -> dict:
    return await svc.governance_summary(session, ctx)
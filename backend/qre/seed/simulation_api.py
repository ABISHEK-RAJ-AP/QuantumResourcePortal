"""Lab-only demo simulation status and controls."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from qre.core.config import get_settings
from qre.core.context import TenantContext
from qre.core.deps import db_session, get_ctx, require_role
from qre.seed.simulation import (
    pause_simulation,
    resume_simulation,
    simulation_status,
    simulation_tick,
    start_simulation,
    stop_simulation,
)

log = logging.getLogger("qre.demo_simulation")

router = APIRouter(tags=["demo-simulation"])


class SimStartBody(BaseModel):
    scenario: int = Field(default=1, ge=1, le=8)


def _lab_only() -> None:
    if not get_settings().is_lab:
        raise HTTPException(status_code=404, detail="Not available outside lab profile.")


@router.get("/demo-simulation/status")
async def get_demo_simulation_status(
    ctx: TenantContext = Depends(get_ctx),
    session: AsyncSession = Depends(db_session),
):
    _lab_only()

    def read(conn):
        return simulation_status(conn, ctx.tenant_id)

    return await session.run_sync(read)


@router.post("/admin/demo-simulation/start")
async def post_demo_sim_start(
    body: SimStartBody,
    ctx: TenantContext = Depends(require_role("PLATFORM_ADMIN")),
    session: AsyncSession = Depends(db_session),
):
    _lab_only()

    def go(conn):
        return start_simulation(conn, ctx.tenant_id, scenario=body.scenario, actor_id=ctx.principal_id)

    return await session.run_sync(go)


@router.post("/admin/demo-simulation/pause")
async def post_demo_sim_pause(
    ctx: TenantContext = Depends(require_role("PLATFORM_ADMIN")),
    session: AsyncSession = Depends(db_session),
):
    _lab_only()
    return await session.run_sync(
        lambda c: pause_simulation(c, ctx.tenant_id, actor_id=ctx.principal_id)
    )


@router.post("/admin/demo-simulation/resume")
async def post_demo_sim_resume(
    ctx: TenantContext = Depends(require_role("PLATFORM_ADMIN")),
    session: AsyncSession = Depends(db_session),
):
    _lab_only()
    return await session.run_sync(
        lambda c: resume_simulation(c, ctx.tenant_id, actor_id=ctx.principal_id)
    )


@router.post("/admin/demo-simulation/stop")
async def post_demo_sim_stop(
    ctx: TenantContext = Depends(require_role("PLATFORM_ADMIN")),
    session: AsyncSession = Depends(db_session),
):
    _lab_only()
    return await session.run_sync(
        lambda c: stop_simulation(c, ctx.tenant_id, actor_id=ctx.principal_id)
    )


@router.post("/admin/demo-simulation/tick")
async def post_demo_sim_tick(
    ctx: TenantContext = Depends(require_role("PLATFORM_ADMIN")),
    session: AsyncSession = Depends(db_session),
):
    _lab_only()
    return await session.run_sync(
        lambda c: simulation_tick(c, ctx.tenant_id, actor_id=ctx.principal_id)
    )
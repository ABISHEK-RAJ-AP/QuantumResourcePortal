"""Lab-only HTTP entrypoint for demo seeding (PLATFORM_ADMIN)."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from qre.core.config import get_settings
from qre.core.context import TenantContext
from qre.core.deps import db_session, require_role
from qre.seed.seed_demo import SeedDemoError, seed_demo, seed_demo_reset

log = logging.getLogger("qre.seed")
router = APIRouter(tags=["demo-seed"])


class SeedDemoBody(BaseModel):
    tenant_code: str | None = Field(default=None, description="Defaults to signed-in tenant code")
    force: bool = False
    reset_only: bool = False


@router.post("/admin/seed-demo")
async def post_seed_demo(
    body: SeedDemoBody,
    ctx: TenantContext = Depends(require_role("PLATFORM_ADMIN")),
    session: AsyncSession = Depends(db_session),
):
    if not get_settings().is_lab:
        raise HTTPException(status_code=403, detail="Demo seed is disabled outside the lab profile.")
    from sqlalchemy import text

    if body.tenant_code:
        code = body.tenant_code.strip()
    else:
        row = await session.execute(
            text("SELECT code FROM tenant WHERE tenant_id = :t"),
            {"t": ctx.tenant_id},
        )
        code = str(row.scalar() or "")
    if not code:
        raise HTTPException(status_code=400, detail="tenant_code is required.")

    def _run(conn):
        if body.reset_only:
            deleted = seed_demo_reset(conn, tenant_code=code)
            return {"reset": deleted}
        try:
            result = seed_demo(conn, tenant_code=code, force=body.force)
        except SeedDemoError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        return {
            "tenant_id": result.tenant_id,
            "tenant_code": result.tenant_code,
            "created": result.created,
            "counts": result.counts,
            "demo_users": result.demo_users,
            "password_hint": "quantum2026 (all lab demo users — see docs/development/QRP_DEMO_ENVIRONMENT.md)",
        }

    try:
        payload = await session.run_sync(_run)
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        log.exception("seed-demo failed")
        raise HTTPException(status_code=500, detail="Seed failed — see server logs.") from exc
    return payload
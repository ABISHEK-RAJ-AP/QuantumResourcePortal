"""Reservation holds API (API-SCH-01)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from qre.core.context import TenantContext
from qre.core.deps import db_session, get_ctx, require_permission
from qre.services.svc07_scheduling import service as svc
from qre.services.svc07_scheduling.schemas import ReservationCreateIn, ReservationTransitionIn

router = APIRouter(tags=["scheduling"])


@router.get("/reservations")
async def list_reservations(
    ctx: TenantContext = Depends(require_permission("reservation:read")),
    session: AsyncSession = Depends(db_session),
    state: str | None = Query(None),
    project_id: str | None = Query(None),
) -> dict:
    return await svc.list_reservations(session, ctx, state=state, project_id=project_id)


@router.post("/reservations", status_code=201)
async def create_reservation(
    body: ReservationCreateIn,
    ctx: TenantContext = Depends(require_permission("reservation:create")),
    session: AsyncSession = Depends(db_session),
) -> dict:
    return await svc.create_reservation(
        session,
        ctx,
        resource_ref=body.resource_ref,
        window_start=body.window_start,
        window_end=body.window_end,
        purpose=body.purpose,
        project_id=body.project_id,
    )


@router.post("/reservations/{reservation_id}/transition")
async def transition_reservation(
    reservation_id: str,
    body: ReservationTransitionIn,
    ctx: TenantContext = Depends(get_ctx),
    session: AsyncSession = Depends(db_session),
) -> dict:
    return await svc.transition_reservation(
        session, ctx, reservation_id, new_state=body.state
    )
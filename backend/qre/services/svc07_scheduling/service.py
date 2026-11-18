"""Governance reservation holds (resource_ref time windows)."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from qre.core import authz
from qre.core.context import ResourceRef, TenantContext
from qre.core.errors import Forbidden, InvalidStateTransition, ResourceNotFound, ValidationFailed
from qre.core.ids import is_ulid, new_ulid

STATES = frozenset({"requested", "active", "released", "cancelled"})
TRANSITIONS: dict[str, list[str]] = {
    "requested": ["active", "cancelled"],
    "active": ["released", "cancelled"],
    "released": [],
    "cancelled": [],
}


def _parse_dt(raw: str, field: str) -> datetime:
    try:
        s = raw.replace("Z", "+00:00")
        return datetime.fromisoformat(s)
    except ValueError as exc:
        raise ValidationFailed(field_errors={field: "Invalid datetime."}) from exc


async def _username(session: AsyncSession, user_id: str) -> str:
    row = (
        await session.execute(text("SELECT username FROM app_user WHERE user_id = :u"), {"u": user_id})
    ).scalar()
    return str(row) if row else user_id


def _overlaps(a_start: datetime, a_end: datetime, b_start: datetime, b_end: datetime) -> bool:
    return a_start < b_end and b_start < a_end


def _conflict_ids(rows: list[dict]) -> set[str]:
    """Pairwise overlap on same resource_ref for non-terminal holds."""
    active_states = {"requested", "active"}
    by_resource: dict[str, list[dict]] = {}
    for r in rows:
        if r["state"] not in active_states:
            continue
        by_resource.setdefault(r["resource_ref"], []).append(r)
    conflicted: set[str] = set()
    for group in by_resource.values():
        for i, a in enumerate(group):
            for b in group[i + 1 :]:
                if _overlaps(a["window_start"], a["window_end"], b["window_start"], b["window_end"]):
                    conflicted.add(a["reservation_id"])
                    conflicted.add(b["reservation_id"])
    return conflicted


def _row_to_item(row: dict, created_by_name: str, has_conflict: bool) -> dict:
    return {
        "reservation_id": row["reservation_id"],
        "resource_ref": row["resource_ref"],
        "project_id": row.get("project_id"),
        "purpose": row["purpose"],
        "state": row["state"],
        "window_start": row["window_start"].isoformat() if row.get("window_start") else None,
        "window_end": row["window_end"].isoformat() if row.get("window_end") else None,
        "created_by": created_by_name,
        "has_conflict": has_conflict,
        "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
    }


def _reservation_ref(ctx: TenantContext, project_id: str | None) -> ResourceRef:
    if project_id:
        return ResourceRef.project(ctx.tenant_id, project_id)
    return ResourceRef.tenant(ctx.tenant_id)


def _require_reservation_perm(
    ctx: TenantContext, permission: str, project_id: str | None
) -> None:
    authz.get().require(ctx, permission, _reservation_ref(ctx, project_id))


async def list_reservations(
    session: AsyncSession,
    ctx: TenantContext,
    *,
    state: str | None = None,
    project_id: str | None = None,
) -> dict:
    if not authz.get().has_permission(ctx, "reservation:read"):
        raise Forbidden(detail="Missing permission reservation:read.")
    params: dict = {"t": ctx.tenant_id}
    clauses = ["r.tenant_id = :t"]
    if state and state != "all":
        if state not in STATES:
            raise ValidationFailed(field_errors={"state": "Invalid state filter."})
        clauses.append("r.state = :state")
        params["state"] = state
    if project_id:
        if not is_ulid(project_id):
            raise ValidationFailed(field_errors={"project_id": "Invalid project id."})
        authz.get().require(ctx, "project:read", ResourceRef.project(ctx.tenant_id, project_id))
        clauses.append("r.project_id = :pid")
        params["pid"] = project_id
    where = " AND ".join(clauses)
    rows = (
        await session.execute(
            text(
                f"""
                SELECT r.reservation_id, r.project_id, r.resource_ref, r.purpose, r.state,
                       r.window_start, r.window_end, r.created_by, r.created_at
                FROM reservation r
                WHERE {where}
                ORDER BY r.window_start DESC
                """
            ),
            params,
        )
    ).mappings().all()
    raw = [dict(r) for r in rows]
    conflicts = _conflict_ids(raw)
    items: list[dict] = []
    for row in raw:
        pid = row.get("project_id")
        if pid:
            if not authz.get().can(
                ctx, "reservation:read", ResourceRef.project(ctx.tenant_id, pid)
            ):
                continue
        elif not authz.get().can(
            ctx, "reservation:read", ResourceRef.tenant(ctx.tenant_id)
        ):
            continue
        uname = await _username(session, row["created_by"])
        items.append(_row_to_item(row, uname, row["reservation_id"] in conflicts))
    return {
        "items": items,
        "transitions": TRANSITIONS,
        "conflict_count": len(conflicts),
    }


async def create_reservation(
    session: AsyncSession,
    ctx: TenantContext,
    *,
    resource_ref: str,
    window_start: str,
    window_end: str,
    purpose: str,
    project_id: str | None,
) -> dict:
    _require_reservation_perm(ctx, "reservation:create", project_id)
    start = _parse_dt(window_start, "window_start")
    end = _parse_dt(window_end, "window_end")
    if end <= start:
        raise ValidationFailed(field_errors={"window_end": "End must be after start."})
    if project_id:
        if not is_ulid(project_id):
            raise ValidationFailed(field_errors={"project_id": "Invalid project id."})
        authz.get().require(ctx, "project:read", ResourceRef.project(ctx.tenant_id, project_id))
        prow = (
            await session.execute(
                text(
                    "SELECT is_archived FROM project WHERE project_id = :p AND tenant_id = :t"
                ),
                {"p": project_id, "t": ctx.tenant_id},
            )
        ).scalar()
        if prow is None:
            raise ResourceNotFound()
        if prow:
            raise ValidationFailed(field_errors={"project_id": "Project is archived."})
    rid = new_ulid()
    await session.execute(
        text(
            """
            INSERT INTO reservation (
                reservation_id, tenant_id, project_id, resource_ref, purpose,
                window_start, window_end, state, created_by
            ) VALUES (
                :id, :t, :pid, :ref, :purpose, :ws, :we, 'requested', :uid
            )
            """
        ),
        {
            "id": rid,
            "t": ctx.tenant_id,
            "pid": project_id,
            "ref": resource_ref.strip(),
            "purpose": purpose.strip(),
            "ws": start,
            "we": end,
            "uid": ctx.principal_id,
        },
    )
    row = (
        await session.execute(
            text(
                """
                SELECT reservation_id, project_id, resource_ref, purpose, state,
                       window_start, window_end, created_by, created_at
                FROM reservation WHERE reservation_id = :id
                """
            ),
            {"id": rid},
        )
    ).mappings().first()
    uname = await _username(session, ctx.principal_id)
    return _row_to_item(dict(row), uname, False)


async def transition_reservation(
    session: AsyncSession,
    ctx: TenantContext,
    reservation_id: str,
    *,
    new_state: str,
) -> dict:
    if new_state not in STATES:
        raise ValidationFailed(field_errors={"state": "Invalid state."})
    row = (
        await session.execute(
            text(
                """
                SELECT reservation_id, tenant_id, project_id, resource_ref, purpose, state,
                       window_start, window_end, created_by, created_at
                FROM reservation WHERE reservation_id = :id
                """
            ),
            {"id": reservation_id},
        )
    ).mappings().first()
    if not row or row["tenant_id"] != ctx.tenant_id:
        raise ResourceNotFound()
    current = row["state"]
    allowed = TRANSITIONS.get(current, [])
    if new_state not in allowed:
        raise InvalidStateTransition(detail=f"Cannot move from {current} to {new_state}.")
    pid = row.get("project_id")
    perm = "reservation:cancel" if new_state == "cancelled" else "reservation:create"
    _require_reservation_perm(ctx, perm, pid)
    _require_reservation_perm(ctx, "reservation:read", pid)
    await session.execute(
        text(
            "UPDATE reservation SET state = :s, updated_at = now() WHERE reservation_id = :id"
        ),
        {"s": new_state, "id": reservation_id},
    )
    updated = dict(row)
    updated["state"] = new_state
    uname = await _username(session, row["created_by"])
    return _row_to_item(updated, uname, False)
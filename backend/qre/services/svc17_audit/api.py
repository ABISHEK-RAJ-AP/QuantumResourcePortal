"""RBAC audit-log API (RBAC-8, API-AUD-01, S-12).

Read, export and integrity-verify the QRP append-only, hash-chained audit log — the record of
identity and authorisation events (logins, role grants/revokes, AUTHZ_DENIED, …). Mounted under
``/rbac/audit`` so it never collides with the TeleScope governance ``/audit`` surface reached
via the gateway.

Every row is scoped to the caller's tenant; the log is append-only (DB trigger + no UPDATE/DELETE
grant), so these endpoints are read-only by construction.
"""
from __future__ import annotations

import csv
import io

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from qre.core.context import TenantContext
from qre.core.deps import db_session, require_permission
from qre.services.svc17_audit.service import verify_chain

router = APIRouter(prefix="/rbac/audit", tags=["audit"])

_COLUMNS = (
    "audit_id", "occurred_at", "actor_id", "actor_type", "action",
    "target_type", "target_id", "outcome", "correlation_id",
)
# Fully-literal queries (constant SQL via adjacent-string concatenation — identifiers are fixed,
# all values are bound parameters, so there is no injection surface).
_LIST = (
    "SELECT audit_id, occurred_at, actor_id, actor_type, action, target_type, "
    "target_id, outcome, correlation_id FROM audit_log WHERE tenant_id = :t "
    "ORDER BY occurred_at DESC, audit_id DESC LIMIT :limit OFFSET :offset"
)
_LIST_ACTION = (
    "SELECT audit_id, occurred_at, actor_id, actor_type, action, target_type, "
    "target_id, outcome, correlation_id FROM audit_log WHERE tenant_id = :t AND action = :a "
    "ORDER BY occurred_at DESC, audit_id DESC LIMIT :limit OFFSET :offset"
)
_COUNT = "SELECT count(*) FROM audit_log WHERE tenant_id = :t"
_COUNT_ACTION = "SELECT count(*) FROM audit_log WHERE tenant_id = :t AND action = :a"
_EXPORT = (
    "SELECT audit_id, occurred_at, actor_id, actor_type, action, target_type, "
    "target_id, outcome, correlation_id FROM audit_log WHERE tenant_id = :t "
    "ORDER BY occurred_at ASC, audit_id ASC"
)


@router.get("")
async def list_audit(
    action: str | None = Query(None, max_length=48),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    ctx: TenantContext = Depends(require_permission("audit:read")),
    session: AsyncSession = Depends(db_session),
) -> dict:
    """Most-recent-first page of audit rows for the tenant, optionally filtered by action."""
    params: dict = {"t": ctx.tenant_id, "limit": limit, "offset": offset}
    if action:
        params["a"] = action
    rows = (await session.execute(text(_LIST_ACTION if action else _LIST), params)).mappings().all()
    count_params = {"t": ctx.tenant_id} | ({"a": action} if action else {})
    total = (
        await session.execute(text(_COUNT_ACTION if action else _COUNT), count_params)
    ).scalar_one()
    items = [{k: (str(r[k]) if r[k] is not None else None) for k in _COLUMNS} for r in rows]
    return {
        "items": items,
        "count": len(items),
        "total": int(total),
        "limit": limit,
        "offset": offset,
    }


@router.get("/verify")
async def verify_audit(
    ctx: TenantContext = Depends(require_permission("audit:verify")),
    session: AsyncSession = Depends(db_session),
) -> dict:
    """Recompute the tenant hash chain and report whether it is intact (TC-AUD-001, S-12)."""
    intact = await session.run_sync(lambda conn: verify_chain(conn, ctx.tenant_id))
    return {"intact": bool(intact), "tenant_id": ctx.tenant_id}


@router.get("/export")
async def export_audit(
    ctx: TenantContext = Depends(require_permission("audit:export")),
    session: AsyncSession = Depends(db_session),
) -> Response:
    """CSV export of the tenant's audit log (oldest-first, stable order)."""
    rows = (await session.execute(text(_EXPORT), {"t": ctx.tenant_id})).mappings().all()
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(_COLUMNS)
    for r in rows:
        writer.writerow(["" if r[k] is None else str(r[k]) for k in _COLUMNS])
    return Response(
        content=buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="audit_log.csv"'},
    )

"""Tenant alert list, summary, and lifecycle."""

from __future__ import annotations

import json

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from qre.core import authz
from qre.core.context import ResourceRef, TenantContext
from qre.core.errors import Forbidden, InvalidStateTransition, ResourceNotFound, ValidationFailed
from qre.core.ids import new_ulid


def _alert_item(row: dict) -> dict:
    comments = row.get("comments") or []
    if isinstance(comments, str):
        comments = json.loads(comments)
    return {
        "alert_id": row["alert_id"],
        "backend_id": row.get("backend_id"),
        "resource_id": row.get("resource_id"),
        "incident_id": row.get("incident_id"),
        "alert_type": row.get("alert_type"),
        "severity": row.get("severity"),
        "status": row.get("status"),
        "title": row.get("title"),
        "message": row.get("message"),
        "current_value": float(row["current_value"]) if row.get("current_value") is not None else None,
        "threshold_value": float(row["threshold_value"]) if row.get("threshold_value") is not None else None,
        "detected_at": row["detected_at"].isoformat() if row.get("detected_at") else None,
        "comments": comments if isinstance(comments, list) else [],
    }


async def alerts_summary(session: AsyncSession, ctx: TenantContext) -> dict:
    authz.get().require(ctx, "alert:read", ResourceRef.tenant(ctx.tenant_id))
    rows = (
        await session.execute(
            text(
                """
                SELECT severity, backend_id, count(*) AS n
                FROM ops_alert
                WHERE tenant_id = :t AND status = 'ACTIVE'
                GROUP BY severity, backend_id
                """
            ),
            {"t": ctx.tenant_id},
        )
    ).mappings().all()
    active = critical = warning = 0
    by_backend: dict[str, int] = {}
    for row in rows:
        n = int(row["n"])
        active += n
        sev = str(row["severity"])
        if sev == "CRITICAL":
            critical += n
        elif sev == "WARNING":
            warning += n
        bid = row.get("backend_id")
        if bid:
            by_backend[str(bid)] = by_backend.get(str(bid), 0) + n
    return {
        "active": active,
        "critical": critical,
        "warning": warning,
        "by_backend": by_backend,
    }


async def list_alerts(
    session: AsyncSession,
    ctx: TenantContext,
    *,
    status: str | None = None,
    resource_id: str | None = None,
    limit: int = 50,
) -> dict:
    authz.get().require(ctx, "alert:read", ResourceRef.tenant(ctx.tenant_id))
    lim = max(1, min(limit, 200))
    params: dict = {"t": ctx.tenant_id, "lim": lim}
    clauses = ["tenant_id = :t"]
    if status:
        st = status.upper()
        if st not in ("ACTIVE", "ACKNOWLEDGED", "RESOLVED"):
            raise ValidationFailed(field_errors={"status": "Invalid status."})
        clauses.append("status = :st")
        params["st"] = st
    if resource_id:
        clauses.append("resource_id = :rid")
        params["rid"] = resource_id
    where = " AND ".join(clauses)
    rows = (
        await session.execute(
            text(
                f"""
                SELECT alert_id, backend_id, resource_id, incident_id, alert_type, severity,
                       status, title, message, current_value, threshold_value, detected_at, comments
                FROM ops_alert
                WHERE {where}
                ORDER BY detected_at DESC
                LIMIT :lim
                """
            ),
            params,
        )
    ).mappings().all()
    return {"items": [_alert_item(dict(r)) for r in rows]}


async def get_alert(session: AsyncSession, ctx: TenantContext, alert_id: str) -> dict:
    authz.get().require(ctx, "alert:read", ResourceRef.tenant(ctx.tenant_id))
    row = (
        await session.execute(
            text(
                """
                SELECT alert_id, backend_id, resource_id, incident_id, alert_type, severity,
                       status, title, message, current_value, threshold_value, detected_at, comments
                FROM ops_alert
                WHERE tenant_id = :t AND alert_id = :id
                """
            ),
            {"t": ctx.tenant_id, "id": alert_id},
        )
    ).mappings().first()
    if not row:
        raise ResourceNotFound()
    return _alert_item(dict(row))


async def _transition(
    session: AsyncSession,
    ctx: TenantContext,
    alert_id: str,
    *,
    new_status: str,
    perm: str,
) -> dict:
    if not authz.get().has_permission(ctx, perm):
        raise Forbidden(detail=f"Missing permission {perm}.")
    row = (
        await session.execute(
            text(
                "SELECT alert_id, tenant_id, status FROM ops_alert WHERE alert_id = :id"
            ),
            {"id": alert_id},
        )
    ).mappings().first()
    if not row or row["tenant_id"] != ctx.tenant_id:
        raise ResourceNotFound()
    current = row["status"]
    allowed = {
        "ACTIVE": {"ACKNOWLEDGED", "RESOLVED"},
        "ACKNOWLEDGED": {"RESOLVED"},
        "RESOLVED": set(),
    }
    if new_status not in allowed.get(current, set()):
        raise InvalidStateTransition(detail=f"Cannot move alert from {current} to {new_status}.")
    await session.execute(
        text(
            "UPDATE ops_alert SET status = :s, updated_at = now() WHERE alert_id = :id"
        ),
        {"s": new_status, "id": alert_id},
    )
    return await get_alert(session, ctx, alert_id)


async def acknowledge_alert(session: AsyncSession, ctx: TenantContext, alert_id: str) -> dict:
    return await _transition(session, ctx, alert_id, new_status="ACKNOWLEDGED", perm="alert:ack")


async def resolve_alert(session: AsyncSession, ctx: TenantContext, alert_id: str) -> dict:
    return await _transition(session, ctx, alert_id, new_status="RESOLVED", perm="alert:resolve")


async def add_comment(
    session: AsyncSession, ctx: TenantContext, alert_id: str, *, text_body: str
) -> dict:
    authz.get().require(ctx, "alert:ack", ResourceRef.tenant(ctx.tenant_id))
    row = await get_alert(session, ctx, alert_id)
    comments = list(row.get("comments") or [])
    comments.append({"text": text_body.strip(), "at": new_ulid()[:8]})
    await session.execute(
        text(
            """
            UPDATE ops_alert
            SET comments = CAST(:c AS JSONB), updated_at = now()
            WHERE alert_id = :id AND tenant_id = :t
            """
        ),
        {"c": json.dumps(comments), "id": alert_id, "t": ctx.tenant_id},
    )
    return await get_alert(session, ctx, alert_id)
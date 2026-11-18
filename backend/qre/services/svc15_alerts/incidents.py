"""Operational incident lifecycle."""

from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from qre.core import authz
from qre.core.context import ResourceRef, TenantContext
from qre.core.errors import Forbidden, InvalidStateTransition, ResourceNotFound, ValidationFailed
from qre.core.ids import new_ulid
from qre.services.svc15_alerts.service import _alert_item

TRANSITIONS = {
    "OPEN": {"ACKNOWLEDGED"},
    "ACKNOWLEDGED": {"INVESTIGATING"},
    "INVESTIGATING": {"RESOLVED"},
    "RESOLVED": {"CLOSED"},
    "CLOSED": set(),
}


def _incident_row(row: dict, alert_count: int) -> dict:
    return {
        "incident_id": row["incident_id"],
        "title": row["title"],
        "summary": row.get("summary") or "",
        "status": row["status"],
        "severity": row["severity"],
        "backend_id": row.get("backend_id"),
        "owner": row.get("owner"),
        "alert_count": alert_count,
        "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
        "updated_at": row["updated_at"].isoformat() if row.get("updated_at") else None,
    }


async def _alert_count(session: AsyncSession, incident_id: str) -> int:
    return int(
        (
            await session.execute(
                text("SELECT count(*) FROM ops_alert WHERE incident_id = :i"),
                {"i": incident_id},
            )
        ).scalar()
        or 0
    )


async def list_incidents(
    session: AsyncSession, ctx: TenantContext, *, limit: int = 50
) -> dict:
    authz.get().require(ctx, "incident:read", ResourceRef.tenant(ctx.tenant_id))
    lim = max(1, min(limit, 200))
    rows = (
        await session.execute(
            text(
                """
                SELECT incident_id, title, summary, status, severity, backend_id, owner,
                       created_at, updated_at
                FROM ops_incident
                WHERE tenant_id = :t
                ORDER BY updated_at DESC
                LIMIT :lim
                """
            ),
            {"t": ctx.tenant_id, "lim": lim},
        )
    ).mappings().all()
    items = []
    for row in rows:
        iid = row["incident_id"]
        cnt = await _alert_count(session, iid)
        items.append(_incident_row(dict(row), cnt))
    return {"items": items}


async def get_incident(session: AsyncSession, ctx: TenantContext, incident_id: str) -> dict:
    authz.get().require(ctx, "incident:read", ResourceRef.tenant(ctx.tenant_id))
    row = (
        await session.execute(
            text(
                """
                SELECT incident_id, title, summary, status, severity, backend_id, owner,
                       created_at, updated_at
                FROM ops_incident
                WHERE tenant_id = :t AND incident_id = :i
                """
            ),
            {"t": ctx.tenant_id, "i": incident_id},
        )
    ).mappings().first()
    if not row:
        raise ResourceNotFound()
    alerts = (
        await session.execute(
            text(
                """
                SELECT alert_id, backend_id, resource_id, incident_id, alert_type, severity,
                       status, title, message, current_value, threshold_value, detected_at, comments
                FROM ops_alert
                WHERE tenant_id = :t AND incident_id = :i
                ORDER BY detected_at DESC
                """
            ),
            {"t": ctx.tenant_id, "i": incident_id},
        )
    ).mappings().all()
    out = _incident_row(dict(row), len(alerts))
    out["alerts"] = [_alert_item(dict(a)) for a in alerts]
    return out


async def _transition(
    session: AsyncSession,
    ctx: TenantContext,
    incident_id: str,
    *,
    new_status: str,
) -> dict:
    if not authz.get().has_permission(ctx, "incident:manage"):
        raise Forbidden(detail="Missing permission incident:manage.")
    row = (
        await session.execute(
            text(
                "SELECT incident_id, tenant_id, status FROM ops_incident WHERE incident_id = :i"
            ),
            {"i": incident_id},
        )
    ).mappings().first()
    if not row or row["tenant_id"] != ctx.tenant_id:
        raise ResourceNotFound()
    current = row["status"]
    if new_status not in TRANSITIONS.get(current, set()):
        raise InvalidStateTransition()
    owner = None
    if new_status == "ACKNOWLEDGED":
        owner = ctx.principal_id
    await session.execute(
        text(
            """
            UPDATE ops_incident
            SET status = :s, owner = COALESCE(:o, owner), updated_at = now()
            WHERE incident_id = :i
            """
        ),
        {"s": new_status, "o": owner, "i": incident_id},
    )
    return await get_incident(session, ctx, incident_id)


async def acknowledge_incident(session: AsyncSession, ctx: TenantContext, incident_id: str) -> dict:
    return await _transition(session, ctx, incident_id, new_status="ACKNOWLEDGED")


async def investigate_incident(session: AsyncSession, ctx: TenantContext, incident_id: str) -> dict:
    return await _transition(session, ctx, incident_id, new_status="INVESTIGATING")


async def resolve_incident(session: AsyncSession, ctx: TenantContext, incident_id: str) -> dict:
    return await _transition(session, ctx, incident_id, new_status="RESOLVED")


async def create_incident(
    session: AsyncSession,
    ctx: TenantContext,
    *,
    title: str,
    summary: str | None,
    severity: str,
    backend_id: str | None,
) -> dict:
    authz.get().require(ctx, "incident:manage", ResourceRef.tenant(ctx.tenant_id))
    if severity not in ("CRITICAL", "WARNING", "INFO"):
        raise ValidationFailed(field_errors={"severity": "Invalid severity."})
    iid = new_ulid()
    await session.execute(
        text(
            """
            INSERT INTO ops_incident (
                incident_id, tenant_id, title, summary, severity, backend_id
            ) VALUES (:i, :t, :title, :sum, :sev, :b)
            """
        ),
        {
            "i": iid,
            "t": ctx.tenant_id,
            "title": title.strip(),
            "sum": summary,
            "sev": severity,
            "b": backend_id,
        },
    )
    return await get_incident(session, ctx, iid)
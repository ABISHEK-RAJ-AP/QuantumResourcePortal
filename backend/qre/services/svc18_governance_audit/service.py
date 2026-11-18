"""Map append-only audit_log rows to governance Audit UI contract."""

from __future__ import annotations

import csv
import io

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from qre.core import authz
from qre.core.context import ResourceRef, TenantContext

_PREFIX_FAMILIES: dict[str, tuple[str, ...]] = {
    "approval": ("WORKLOAD", "APPROVAL", "SUBMIT", "WITHDRAW"),
    "inventory": ("ASSET", "INVENTORY"),
    "quota": ("QUOTA",),
    "dispatch": ("DISPATCH",),
    "user": ("USER", "ROLE", "MEMBERSHIP", "LOGIN", "AUTH"),
    "alert": ("ALERT", "INCIDENT"),
}


def _governance_action(raw: str) -> str:
    parts = raw.lower().split("_")
    if len(parts) >= 2:
        return f"{parts[0]}.{'.'.join(parts[1:])}"
    return raw.lower()


def _matches_prefix(raw_action: str, prefix: str | None) -> bool:
    if not prefix or prefix == "all":
        return True
    gov = _governance_action(raw_action)
    if gov.startswith(f"{prefix.lower()}."):
        return True
    families = _PREFIX_FAMILIES.get(prefix.lower(), (prefix.upper(),))
    upper = raw_action.upper()
    return any(upper.startswith(f) for f in families)


async def _actor_name(session: AsyncSession, actor_id: str | None) -> str:
    if not actor_id:
        return "system"
    row = (
        await session.execute(
            text("SELECT username FROM app_user WHERE user_id = :u"),
            {"u": actor_id},
        )
    ).scalar()
    return str(row) if row else actor_id


def _row_item(row: dict, actor: str) -> dict:
    return {
        "timestamp": row["occurred_at"].isoformat() if row.get("occurred_at") else None,
        "actor": actor,
        "role": row.get("actor_type") or "",
        "action": _governance_action(row["action"]),
        "target_type": row.get("target_type") or "",
        "target_id": row.get("target_id") or "",
        "outcome": row.get("outcome") or "",
        "correlation_id": row.get("correlation_id") or "",
    }


async def list_audit_events(
    session: AsyncSession,
    ctx: TenantContext,
    *,
    limit: int = 100,
    action_prefix: str | None = None,
) -> dict:
    authz.get().require(ctx, "audit:read", ResourceRef.tenant(ctx.tenant_id))
    lim = max(1, min(limit, 500))
    rows = (
        await session.execute(
            text(
                """
                SELECT audit_id, occurred_at, actor_id, actor_type, action, target_type,
                       target_id, outcome, correlation_id
                FROM audit_log
                WHERE tenant_id = :t
                ORDER BY occurred_at DESC, audit_id DESC
                LIMIT :lim
                """
            ),
            {"t": ctx.tenant_id, "lim": lim * 3},
        )
    ).mappings().all()
    items: list[dict] = []
    for row in rows:
        raw = str(row["action"])
        if not _matches_prefix(raw, action_prefix):
            continue
        actor = await _actor_name(session, row.get("actor_id"))
        items.append(_row_item(dict(row), actor))
        if len(items) >= lim:
            break
    return {"items": items}


async def export_audit_events_csv(
    session: AsyncSession,
    ctx: TenantContext,
    *,
    limit: int = 500,
    action_prefix: str | None = None,
) -> str:
    authz.get().require(ctx, "audit:export", ResourceRef.tenant(ctx.tenant_id))
    body = await list_audit_events(
        session, ctx, limit=limit, action_prefix=action_prefix
    )
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["timestamp", "actor", "role", "action", "target_type", "target_id", "outcome"])
    for row in body["items"]:
        writer.writerow(
            [
                row.get("timestamp"),
                row.get("actor"),
                row.get("role"),
                row.get("action"),
                row.get("target_type"),
                row.get("target_id"),
                row.get("outcome"),
            ]
        )
    return buf.getvalue()
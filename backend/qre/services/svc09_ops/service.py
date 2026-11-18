"""Operations centre KPIs and governance activity (derived from shipped tables)."""

from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from qre.core import authz
from qre.core.context import ResourceRef, TenantContext
from qre.core.errors import ValidationFailed
from qre.services.svc05_quotas.service import _shots_from_metadata


async def _username(session: AsyncSession, user_id: str) -> str:
    row = (
        await session.execute(
            text("SELECT username FROM app_user WHERE user_id = :u"),
            {"u": user_id},
        )
    ).scalar()
    return str(row) if row else user_id


async def operations_centre(session: AsyncSession, ctx: TenantContext) -> dict:
    authz.get().require(ctx, "governance:read", ResourceRef.tenant(ctx.tenant_id))
    tid = ctx.tenant_id
    counts = (
        await session.execute(
            text(
                """
                SELECT operational_status, count(*) AS n
                FROM catalogue_backend
                WHERE tenant_id = :t
                GROUP BY operational_status
                """
            ),
            {"t": tid},
        )
    ).mappings().all()
    by_status = {str(r["operational_status"]): int(r["n"]) for r in counts}
    total = sum(by_status.values())
    online = by_status.get("ONLINE", 0)
    offline = by_status.get("OFFLINE", 0)
    maint = by_status.get("MAINTENANCE", 0)
    sim = (
        await session.execute(
            text(
                """
                SELECT count(*) FROM inventory_asset
                WHERE tenant_id = :t AND execution_class = 'simulated'
                """
            ),
            {"t": tid},
        )
    ).scalar()
    providers = (
        await session.execute(
            text(
                """
                SELECT provider_id, provider_name, integration
                FROM catalogue_provider
                WHERE tenant_id = :t
                ORDER BY provider_name
                """
            ),
            {"t": tid},
        )
    ).mappings().all()
    collector_rows = []
    for p in providers:
        integration = p.get("integration") or {}
        if isinstance(integration, str):
            integration = json.loads(integration)
        collector_rows.append(
            {
                "provider_id": p["provider_id"],
                "provider_name": p["provider_name"],
                "collector_last_status": integration.get("collector_last_status"),
            }
        )
    backends = (
        await session.execute(
            text(
                """
                SELECT backend_id, backend_name, operational_status, provider_id
                FROM catalogue_backend
                WHERE tenant_id = :t
                ORDER BY backend_name
                LIMIT 24
                """
            ),
            {"t": tid},
        )
    ).mappings().all()
    open_dispatch = (
        await session.execute(
            text(
                """
                SELECT count(*) FROM dispatch_attempt
                WHERE tenant_id = :t
                  AND dispatch_state IN ('dispatch_authorized', 'dispatch_unresolved')
                """
            ),
            {"t": tid},
        )
    ).scalar()
    active_alerts = (
        await session.execute(
            text(
                "SELECT count(*) FROM ops_alert WHERE tenant_id = :t AND status = 'ACTIVE'"
            ),
            {"t": tid},
        )
    ).scalar()
    open_incidents = (
        await session.execute(
            text(
                """
                SELECT count(*) FROM ops_incident
                WHERE tenant_id = :t
                  AND status NOT IN ('RESOLVED', 'CLOSED')
                """
            ),
            {"t": tid},
        )
    ).scalar()
    return {
        "operations": {
            "open_incidents": int(open_incidents or 0),
            "active_alerts": int(active_alerts or 0),
            "open_dispatch_attempts": int(open_dispatch or 0),
        },
        "fleet": {
            "online": online,
            "offline": offline,
            "maintenance_or_other": maint,
            "total": total,
            "simulated_catalog": int(sim or 0),
        },
        "collectors": {"providers": collector_rows},
        "backends_snapshot": [dict(b) for b in backends],
        "classical_hpc": [],
        "data_platform": {"status": "not_configured"},
    }


async def governance_activity(
    session: AsyncSession,
    ctx: TenantContext,
    *,
    limit: int = 8,
    project_id: str | None = None,
) -> dict:
    authz.get().require(ctx, "governance:read", ResourceRef.tenant(ctx.tenant_id))
    lim = max(1, min(limit, 200))
    params: dict = {"t": ctx.tenant_id}
    clauses = ["w.tenant_id = :t"]
    if project_id:
        clauses.append("w.project_id = :p")
        params["p"] = project_id
    where = " AND ".join(clauses)
    workloads = (
        await session.execute(
            text(
                f"""
                SELECT w.workload_id, w.project_id, w.history, w.updated_at
                FROM workload w
                WHERE {where}
                ORDER BY w.updated_at DESC
                LIMIT 200
                """
            ),
            params,
        )
    ).mappings().all()
    items: list[dict] = []
    names: dict[str, str] = {}
    for row in workloads:
        wid = row["workload_id"]
        history = row.get("history") or []
        if isinstance(history, str):
            history = json.loads(history)
        if not isinstance(history, list):
            continue
        for entry in history:
            if not isinstance(entry, dict):
                continue
            actor_id = str(entry.get("actor_id") or "")
            if actor_id and actor_id not in names:
                names[actor_id] = await _username(session, actor_id)
            action = str(entry.get("action") or "unknown")
            items.append(
                {
                    "timestamp": entry.get("at") or row["updated_at"].isoformat(),
                    "actor": names.get(actor_id, actor_id or "—"),
                    "action": f"approval.{action}",
                    "target_id": wid,
                    "project_id": row.get("project_id"),
                }
            )
    da_clauses = ["d.tenant_id = :t"]
    if project_id:
        da_clauses.append("d.workload_id IN (SELECT workload_id FROM workload WHERE project_id = :p)")
    da_where = " AND ".join(da_clauses)
    attempts = (
        await session.execute(
            text(
                f"""
                SELECT d.attempt_id, d.workload_id, d.dispatch_state, d.updated_at, d.reconcile_reason
                FROM dispatch_attempt d
                WHERE {da_where}
                ORDER BY d.updated_at DESC
                LIMIT 100
                """
            ),
            params,
        )
    ).mappings().all()
    for row in attempts:
        items.append(
            {
                "timestamp": row["updated_at"].isoformat() if row.get("updated_at") else None,
                "actor": "system",
                "action": f"dispatch.{row['dispatch_state']}",
                "target_id": row["workload_id"],
                "project_id": project_id,
            }
        )
    items = [i for i in items if i.get("timestamp")]
    items.sort(key=lambda x: str(x["timestamp"]), reverse=True)
    return {"items": items[:lim]}
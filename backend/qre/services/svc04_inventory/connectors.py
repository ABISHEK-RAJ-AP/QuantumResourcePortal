"""Connector board BFF over provider catalogue."""

from __future__ import annotations

import json
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from qre.core import authz
from qre.core.context import ResourceRef, TenantContext

STAGE_LEGEND = {
    "I1": "Registered — no manifest on file.",
    "I2": "Manifest published — collector pending.",
    "I3": "Collector evidence on file.",
    "I4": "Dispatch path verified.",
    "I5": "Reconciled dispatch — live connector claim allowed.",
}


def _integration(raw: Any) -> dict:
    if isinstance(raw, str):
        raw = json.loads(raw)
    return dict(raw) if isinstance(raw, dict) else {}


async def connectors_board(session: AsyncSession, ctx: TenantContext) -> dict:
    authz.get().require(ctx, "connector:read", ResourceRef.tenant(ctx.tenant_id))
    backends = (
        await session.execute(
            text(
                """
                SELECT provider_id, count(*) AS n
                FROM catalogue_backend
                WHERE tenant_id = :t
                GROUP BY provider_id
                """
            ),
            {"t": ctx.tenant_id},
        )
    ).mappings().all()
    backend_counts = {str(r["provider_id"]): int(r["n"]) for r in backends}
    rows = (
        await session.execute(
            text(
                """
                SELECT provider_id, provider_name, status, integration, updated_at
                FROM catalogue_provider
                WHERE tenant_id = :t
                ORDER BY provider_name
                """
            ),
            {"t": ctx.tenant_id},
        )
    ).mappings().all()
    items: list[dict] = []
    for row in rows:
        integration = _integration(row.get("integration"))
        integration.setdefault("collector_backends_detected", backend_counts.get(row["provider_id"], 0))
        integration.setdefault("circuit_open", False)
        integration.setdefault(
            "collector_last_run_at",
            row["updated_at"].isoformat() if row.get("updated_at") else None,
        )
        items.append(
            {
                "provider_id": row["provider_id"],
                "provider_name": row["provider_name"],
                "status": row["status"],
                "integration": integration,
            }
        )
    return {"items": items, "legend": STAGE_LEGEND}
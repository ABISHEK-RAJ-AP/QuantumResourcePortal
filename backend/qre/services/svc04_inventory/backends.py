"""Backend catalogue and queue snapshots (read models until svc08)."""

from __future__ import annotations

import json
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from qre.core import authz
from qre.core.context import ResourceRef, TenantContext
from qre.core.errors import ResourceNotFound, ValidationFailed

DEFAULT_QUEUE = {"pending_jobs": 0, "queue_condition": "idle", "trend": "flat"}


def _queue(raw: Any) -> dict[str, Any]:
    if isinstance(raw, str):
        raw = json.loads(raw)
    if not isinstance(raw, dict):
        return dict(DEFAULT_QUEUE)
    out = dict(DEFAULT_QUEUE)
    out.update(raw)
    return out


def _topology(raw: Any) -> dict[str, Any]:
    if isinstance(raw, str):
        raw = json.loads(raw)
    if not isinstance(raw, dict):
        return {"nodes": [], "edges": []}
    nodes = raw.get("nodes") if isinstance(raw.get("nodes"), list) else []
    edges = raw.get("edges") if isinstance(raw.get("edges"), list) else []
    return {"nodes": nodes, "edges": edges}


def _backend_item(row: dict) -> dict:
    return {
        "backend_id": row["backend_id"],
        "provider_id": row["provider_id"],
        "backend_name": row["backend_name"],
        "operational_status": row["operational_status"],
        "qubit_count": row.get("qubit_count"),
        "qpu_modality": row.get("qpu_modality"),
        "topology_type": row.get("topology_type"),
    }


def _require_read(ctx: TenantContext) -> None:
    authz.get().require(ctx, "provider:read", ResourceRef.tenant(ctx.tenant_id))


async def _fetch_backend(session: AsyncSession, ctx: TenantContext, backend_id: str) -> dict:
    row = (
        await session.execute(
            text(
                """
                SELECT backend_id, provider_id, backend_name, operational_status,
                       qubit_count, qpu_modality, topology_type, topology, queue_snapshot
                FROM catalogue_backend
                WHERE tenant_id = :t AND backend_id = :b
                """
            ),
            {"t": ctx.tenant_id, "b": backend_id},
        )
    ).mappings().first()
    if not row:
        raise ResourceNotFound()
    return dict(row)


async def list_backends(session: AsyncSession, ctx: TenantContext) -> dict:
    _require_read(ctx)
    rows = (
        await session.execute(
            text(
                """
                SELECT backend_id, provider_id, backend_name, operational_status,
                       qubit_count, qpu_modality, topology_type
                FROM catalogue_backend
                WHERE tenant_id = :t
                ORDER BY backend_name ASC, backend_id ASC
                """
            ),
            {"t": ctx.tenant_id},
        )
    ).mappings().all()
    return {"items": [_backend_item(dict(r)) for r in rows]}


async def get_backend(session: AsyncSession, ctx: TenantContext, backend_id: str) -> dict:
    if not backend_id or len(backend_id) > 128:
        raise ValidationFailed(field_errors={"backend_id": "Invalid backend id."})
    _require_read(ctx)
    return _backend_item(await _fetch_backend(session, ctx, backend_id))


async def backend_status(session: AsyncSession, ctx: TenantContext, backend_id: str) -> dict:
    _require_read(ctx)
    row = await _fetch_backend(session, ctx, backend_id)
    q = _queue(row.get("queue_snapshot"))
    return {
        "backend_id": row["backend_id"],
        "operational_status": row["operational_status"],
        "pending_jobs": int(q.get("pending_jobs") or 0),
    }


async def backend_topology(session: AsyncSession, ctx: TenantContext, backend_id: str) -> dict:
    _require_read(ctx)
    row = await _fetch_backend(session, ctx, backend_id)
    topo = _topology(row.get("topology"))
    nodes = topo["nodes"]
    edges = topo["edges"]
    return {
        "backend_id": row["backend_id"],
        "topology_type": row.get("topology_type"),
        "node_count": len(nodes),
        "edge_count": len(edges),
        "nodes": nodes,
        "edges": edges,
    }


def _queue_item(row: dict) -> dict:
    q = _queue(row.get("queue_snapshot"))
    return {
        "backend_id": row["backend_id"],
        "provider_id": row["provider_id"],
        "backend_name": row["backend_name"],
        "operational_status": row["operational_status"],
        "pending_jobs": int(q.get("pending_jobs") or 0),
        "queue_condition": str(q.get("queue_condition") or "idle"),
        "trend": str(q.get("trend") or "flat"),
        "estimated_wait_time": q.get("estimated_wait_time"),
    }


async def list_queues(session: AsyncSession, ctx: TenantContext) -> dict:
    _require_read(ctx)
    rows = (
        await session.execute(
            text(
                """
                SELECT backend_id, provider_id, backend_name, operational_status, queue_snapshot
                FROM catalogue_backend
                WHERE tenant_id = :t
                ORDER BY backend_name ASC
                """
            ),
            {"t": ctx.tenant_id},
        )
    ).mappings().all()
    return {"items": [_queue_item(dict(r)) for r in rows]}


async def get_queue(session: AsyncSession, ctx: TenantContext, backend_id: str) -> dict:
    _require_read(ctx)
    row = await _fetch_backend(session, ctx, backend_id)
    return _queue_item(row)


async def create_backend(
    session: AsyncSession,
    ctx: TenantContext,
    *,
    backend_id: str,
    provider_id: str,
    backend_name: str,
    operational_status: str = "OFFLINE",
    qubit_count: int | None = None,
    qpu_modality: str | None = None,
    topology_type: str | None = None,
    topology: dict | None = None,
) -> dict:
    authz.get().require(ctx, "asset:create", ResourceRef.tenant(ctx.tenant_id))
    provider = (
        await session.execute(
            text(
                "SELECT 1 FROM catalogue_provider WHERE tenant_id = :t AND provider_id = :p"
            ),
            {"t": ctx.tenant_id, "p": provider_id},
        )
    ).first()
    if not provider:
        raise ValidationFailed(field_errors={"provider_id": "Unknown provider."})
    if operational_status not in ("ONLINE", "OFFLINE", "MAINTENANCE"):
        raise ValidationFailed(field_errors={"operational_status": "Invalid status."})
    topo = topology or {"nodes": [], "edges": []}
    await session.execute(
        text(
            """
            INSERT INTO catalogue_backend (
                tenant_id, backend_id, provider_id, backend_name, operational_status,
                qubit_count, qpu_modality, topology_type, topology, queue_snapshot
            ) VALUES (
                :t, :b, :p, :n, :st, :q, :m, :tt,
                CAST(:topo AS JSONB), CAST(:qsnap AS JSONB)
            )
            """
        ),
        {
            "t": ctx.tenant_id,
            "b": backend_id.strip(),
            "p": provider_id.strip(),
            "n": backend_name.strip(),
            "st": operational_status,
            "q": qubit_count,
            "m": qpu_modality,
            "tt": topology_type,
            "topo": json.dumps(topo),
            "qsnap": json.dumps(DEFAULT_QUEUE),
        },
    )
    return _backend_item(await _fetch_backend(session, ctx, backend_id))
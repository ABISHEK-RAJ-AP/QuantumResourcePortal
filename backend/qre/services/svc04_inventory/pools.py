"""Virtual resource pools."""

from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from qre.core import authz
from qre.core.context import ResourceRef, TenantContext
from qre.core.errors import ResourceNotFound, ValidationFailed
from qre.core.ids import is_ulid, new_ulid


async def list_pools(session: AsyncSession, ctx: TenantContext) -> dict:
    authz.get().require(ctx, "pool:read", ResourceRef.tenant(ctx.tenant_id))
    rows = (
        await session.execute(
            text(
                """
                SELECT p.pool_id, p.name, p.description,
                       (SELECT count(*) FROM virtual_pool_member m WHERE m.pool_id = p.pool_id) AS member_count
                FROM virtual_pool p
                WHERE p.tenant_id = :t
                ORDER BY p.name
                """
            ),
            {"t": ctx.tenant_id},
        )
    ).mappings().all()
    items = [
        {
            "pool_id": r["pool_id"],
            "name": r["name"],
            "description": r.get("description") or "",
            "member_count": int(r["member_count"] or 0),
        }
        for r in rows
    ]
    return {"items": items}


async def create_pool(session: AsyncSession, ctx: TenantContext, *, name: str) -> dict:
    authz.get().require(ctx, "pool:manage", ResourceRef.tenant(ctx.tenant_id))
    name = name.strip()
    if not name:
        raise ValidationFailed(field_errors={"name": "Name is required."})
    pid = new_ulid()
    await session.execute(
        text(
            """
            INSERT INTO virtual_pool (pool_id, tenant_id, name, created_by)
            VALUES (:id, :t, :n, :u)
            """
        ),
        {"id": pid, "t": ctx.tenant_id, "n": name, "u": ctx.principal_id},
    )
    return {
        "pool_id": pid,
        "name": name,
        "description": "",
        "member_count": 0,
    }


async def get_pool(session: AsyncSession, ctx: TenantContext, pool_id: str) -> dict:
    authz.get().require(ctx, "pool:read", ResourceRef.tenant(ctx.tenant_id))
    row = (
        await session.execute(
            text(
                """
                SELECT pool_id, name, description
                FROM virtual_pool
                WHERE tenant_id = :t AND pool_id = :p
                """
            ),
            {"t": ctx.tenant_id, "p": pool_id},
        )
    ).mappings().first()
    if not row:
        raise ResourceNotFound()
    members = (
        await session.execute(
            text(
                """
                SELECT m.asset_id, a.asset_class, a.execution_class, a.lifecycle_state, a.provider_id
                FROM virtual_pool_member m
                JOIN inventory_asset a ON a.asset_id = m.asset_id AND a.tenant_id = m.tenant_id
                WHERE m.tenant_id = :t AND m.pool_id = :p
                ORDER BY m.added_at
                """
            ),
            {"t": ctx.tenant_id, "p": pool_id},
        )
    ).mappings().all()
    return {
        "pool_id": row["pool_id"],
        "name": row["name"],
        "description": row.get("description") or "",
        "member_count": len(members),
        "members": [dict(m) for m in members],
    }


async def add_member(
    session: AsyncSession, ctx: TenantContext, pool_id: str, *, asset_id: str
) -> dict:
    authz.get().require(ctx, "pool:manage", ResourceRef.tenant(ctx.tenant_id))
    if not is_ulid(asset_id):
        raise ValidationFailed(field_errors={"asset_id": "Invalid asset id."})
    pool = (
        await session.execute(
            text("SELECT 1 FROM virtual_pool WHERE tenant_id = :t AND pool_id = :p"),
            {"t": ctx.tenant_id, "p": pool_id},
        )
    ).first()
    if not pool:
        raise ResourceNotFound()
    asset = (
        await session.execute(
            text(
                "SELECT 1 FROM inventory_asset WHERE tenant_id = :t AND asset_id = :a"
            ),
            {"t": ctx.tenant_id, "a": asset_id},
        )
    ).first()
    if not asset:
        raise ValidationFailed(field_errors={"asset_id": "Unknown asset."})
    await session.execute(
        text(
            """
            INSERT INTO virtual_pool_member (pool_id, tenant_id, asset_id)
            VALUES (:p, :t, :a)
            ON CONFLICT DO NOTHING
            """
        ),
        {"p": pool_id, "t": ctx.tenant_id, "a": asset_id},
    )
    return await get_pool(session, ctx, pool_id)
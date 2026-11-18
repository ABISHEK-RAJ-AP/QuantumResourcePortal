"""Tenant inventory assets and lifecycle FSM (API-INV-01)."""

from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from qre.core import authz
from qre.core.context import ResourceRef, TenantContext
from qre.core.errors import Forbidden, InvalidStateTransition, ResourceNotFound, ValidationFailed
from qre.core.ids import is_ulid, new_ulid

LIFECYCLE_STATES = frozenset(
    {"registered", "active", "maintenance", "suspended", "retired"}
)
EXECUTION_CLASSES = frozenset({"simulated", "hardware"})
TRANSITIONS: dict[str, list[str]] = {
    "registered": ["active", "retired"],
    "active": ["maintenance", "suspended", "retired"],
    "maintenance": ["active", "suspended", "retired"],
    "suspended": ["active", "maintenance", "retired"],
    "retired": [],
}


def _allowed_transitions(state: str) -> list[str]:
    return list(TRANSITIONS.get(state, []))


def _row_to_item(row: dict, *, include_transitions: bool) -> dict:
    out = {
        "asset_id": row["asset_id"],
        "provider_id": row["provider_id"],
        "native_asset_id": row["native_asset_id"],
        "asset_class": row["asset_class"],
        "execution_class": row["execution_class"],
        "lifecycle_state": row["lifecycle_state"],
        "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
        "updated_at": row["updated_at"].isoformat() if row.get("updated_at") else None,
    }
    if include_transitions:
        out["allowed_transitions"] = _allowed_transitions(row["lifecycle_state"])
    return out


def _require_tenant_inventory(ctx: TenantContext, permission: str) -> None:
    authz.get().require(ctx, permission, ResourceRef.tenant(ctx.tenant_id))


async def list_assets(
    session: AsyncSession,
    ctx: TenantContext,
    *,
    execution_class: str | None = None,
    lifecycle_state: str | None = None,
) -> dict:
    _require_tenant_inventory(ctx, "asset:read")
    params: dict = {"t": ctx.tenant_id}
    clauses = ["tenant_id = :t"]
    if execution_class:
        if execution_class not in EXECUTION_CLASSES:
            raise ValidationFailed(field_errors={"execution_class": "Invalid value."})
        clauses.append("execution_class = :exec")
        params["exec"] = execution_class
    if lifecycle_state:
        if lifecycle_state not in LIFECYCLE_STATES:
            raise ValidationFailed(field_errors={"lifecycle_state": "Invalid value."})
        clauses.append("lifecycle_state = :life")
        params["life"] = lifecycle_state
    where = " AND ".join(clauses)
    rows = (
        await session.execute(
            text(
                f"""
                SELECT asset_id, provider_id, native_asset_id, asset_class, execution_class,
                       lifecycle_state, created_at, updated_at
                FROM inventory_asset
                WHERE {where}
                ORDER BY created_at DESC
                """
            ),
            params,
        )
    ).mappings().all()
    items = [_row_to_item(dict(r), include_transitions=False) for r in rows]
    return {"items": items}


async def get_asset(session: AsyncSession, ctx: TenantContext, asset_id: str) -> dict:
    if not is_ulid(asset_id):
        raise ValidationFailed(field_errors={"asset_id": "Invalid asset id."})
    _require_tenant_inventory(ctx, "asset:read")
    row = (
        await session.execute(
            text(
                """
                SELECT asset_id, tenant_id, provider_id, native_asset_id, asset_class,
                       execution_class, lifecycle_state, created_at, updated_at
                FROM inventory_asset
                WHERE asset_id = :id
                """
            ),
            {"id": asset_id},
        )
    ).mappings().first()
    if not row or row["tenant_id"] != ctx.tenant_id:
        raise ResourceNotFound()
    return _row_to_item(dict(row), include_transitions=True)


async def create_asset(
    session: AsyncSession,
    ctx: TenantContext,
    *,
    provider_id: str,
    native_asset_id: str,
    asset_class: str,
    execution_class: str,
) -> dict:
    _require_tenant_inventory(ctx, "asset:create")
    provider_id = provider_id.strip()
    native_asset_id = native_asset_id.strip()
    asset_class = asset_class.strip()
    if execution_class not in EXECUTION_CLASSES:
        raise ValidationFailed(field_errors={"execution_class": "Must be simulated or hardware."})
    # ponytail: duplicate check avoids unique-violation → 500 on concurrent inserts
    dup = (
        await session.execute(
            text(
                """
                SELECT 1 FROM inventory_asset
                WHERE tenant_id = :t AND provider_id = :p AND native_asset_id = :n
                """
            ),
            {"t": ctx.tenant_id, "p": provider_id, "n": native_asset_id},
        )
    ).first()
    if dup:
        raise ValidationFailed(
            field_errors={"native_asset_id": "Already registered for this provider."}
        )
    aid = new_ulid()
    await session.execute(
        text(
            """
            INSERT INTO inventory_asset (
                asset_id, tenant_id, provider_id, native_asset_id,
                asset_class, execution_class, lifecycle_state, created_by
            ) VALUES (
                :id, :t, :p, :n, :cls, :exec, 'registered', :uid
            )
            """
        ),
        {
            "id": aid,
            "t": ctx.tenant_id,
            "p": provider_id,
            "n": native_asset_id,
            "cls": asset_class,
            "exec": execution_class,
            "uid": ctx.principal_id,
        },
    )
    return await get_asset(session, ctx, aid)


async def transition_lifecycle(
    session: AsyncSession,
    ctx: TenantContext,
    asset_id: str,
    *,
    lifecycle_state: str,
) -> dict:
    if lifecycle_state not in LIFECYCLE_STATES:
        raise ValidationFailed(field_errors={"lifecycle_state": "Invalid state."})
    row = (
        await session.execute(
            text(
                """
                SELECT asset_id, tenant_id, lifecycle_state
                FROM inventory_asset
                WHERE asset_id = :id
                """
            ),
            {"id": asset_id},
        )
    ).mappings().first()
    if not row or row["tenant_id"] != ctx.tenant_id:
        raise ResourceNotFound()
    current = row["lifecycle_state"]
    allowed = TRANSITIONS.get(current, [])
    if lifecycle_state not in allowed:
        raise InvalidStateTransition(
            detail=f"Cannot move from {current} to {lifecycle_state}."
        )
    perm = "asset:retire" if lifecycle_state == "retired" else "asset:update"
    if not authz.get().has_permission(ctx, perm):
        raise Forbidden(detail=f"Missing permission {perm}.")
    _require_tenant_inventory(ctx, "asset:read")
    await session.execute(
        text(
            """
            UPDATE inventory_asset
            SET lifecycle_state = :s, updated_at = now()
            WHERE asset_id = :id
            """
        ),
        {"s": lifecycle_state, "id": asset_id},
    )
    return await get_asset(session, ctx, asset_id)
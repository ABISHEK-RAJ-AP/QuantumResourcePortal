"""Provider catalogue (API-PRV-01–03)."""

from __future__ import annotations

import json
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from qre.core import authz
from qre.core.context import ResourceRef, TenantContext
from qre.core.errors import Forbidden, InvalidStateTransition, ResourceNotFound, ValidationFailed

PROVIDER_STATUSES = frozenset({"draft", "active", "suspended"})
CATALOGUE_TRANSITIONS: dict[str, frozenset[str]] = {
    "draft": frozenset({"active", "suspended"}),
    "active": frozenset({"suspended"}),
    "suspended": frozenset({"active"}),
}
STAGES = ("I1", "I2", "I3", "I4", "I5")


def _default_integration() -> dict[str, Any]:
    return {
        "stage": "I1",
        "manifest_registered": False,
        "collector_last_status": None,
        "operations": [],
        "execution_classes": [],
    }


def _integration(raw: Any) -> dict[str, Any]:
    base = _default_integration()
    if isinstance(raw, str):
        raw = json.loads(raw)
    if isinstance(raw, dict):
        base.update(raw)
    return base


def _provider_row(row: dict) -> dict:
    return {
        "provider_id": row["provider_id"],
        "provider_name": row["provider_name"],
        "status": row["status"],
        "integration": _integration(row.get("integration")),
    }


def _require_provider_perm(ctx: TenantContext, permission: str) -> None:
    authz.get().require(ctx, permission, ResourceRef.tenant(ctx.tenant_id))


def _advance_stage(integration: dict[str, Any], *, manifest: bool) -> str:
    stage = str(integration.get("stage") or "I1")
    try:
        idx = STAGES.index(stage)
    except ValueError:
        idx = 0
    if manifest and idx < 1:
        return "I2"
    if manifest and idx < 2 and integration.get("collector_last_status"):
        return "I3"
    return stage


async def list_providers(session: AsyncSession, ctx: TenantContext) -> dict:
    _require_provider_perm(ctx, "provider:read")
    rows = (
        await session.execute(
            text(
                """
                SELECT provider_id, provider_name, status, integration
                FROM catalogue_provider
                WHERE tenant_id = :t
                ORDER BY provider_name ASC, provider_id ASC
                """
            ),
            {"t": ctx.tenant_id},
        )
    ).mappings().all()
    return {"items": [_provider_row(dict(r)) for r in rows]}


async def create_provider(
    session: AsyncSession,
    ctx: TenantContext,
    *,
    provider_id: str,
    provider_name: str,
) -> dict:
    _require_provider_perm(ctx, "provider:create")
    provider_id = provider_id.strip()
    provider_name = provider_name.strip()
    if not provider_id or len(provider_id) > 128:
        raise ValidationFailed(field_errors={"provider_id": "Invalid provider id."})
    dup = (
        await session.execute(
            text(
                "SELECT 1 FROM catalogue_provider WHERE tenant_id = :t AND provider_id = :p"
            ),
            {"t": ctx.tenant_id, "p": provider_id},
        )
    ).first()
    if dup:
        raise ValidationFailed(field_errors={"provider_id": "Provider id already exists."})
    integration = json.dumps(_default_integration())
    await session.execute(
        text(
            """
            INSERT INTO catalogue_provider (
                tenant_id, provider_id, provider_name, status, integration, created_by
            ) VALUES (:t, :p, :n, 'draft', CAST(:i AS JSONB), :u)
            """
        ),
        {"t": ctx.tenant_id, "p": provider_id, "n": provider_name, "i": integration, "u": ctx.principal_id},
    )
    row = (
        await session.execute(
            text(
                """
                SELECT provider_id, provider_name, status, integration
                FROM catalogue_provider
                WHERE tenant_id = :t AND provider_id = :p
                """
            ),
            {"t": ctx.tenant_id, "p": provider_id},
        )
    ).mappings().first()
    return _provider_row(dict(row))


async def _get_provider_row(
    session: AsyncSession, ctx: TenantContext, provider_id: str
) -> dict:
    row = (
        await session.execute(
            text(
                """
                SELECT provider_id, provider_name, status, integration, tenant_id
                FROM catalogue_provider
                WHERE tenant_id = :t AND provider_id = :p
                """
            ),
            {"t": ctx.tenant_id, "p": provider_id},
        )
    ).mappings().first()
    if not row:
        raise ResourceNotFound()
    return dict(row)


async def submit_onboarding(
    session: AsyncSession,
    ctx: TenantContext,
    provider_id: str,
    *,
    operations: list[str],
    execution_classes: list[str],
) -> dict:
    _require_provider_perm(ctx, "provider:manifest:write")
    row = await _get_provider_row(session, ctx, provider_id)
    integration = _integration(row.get("integration"))
    integration["operations"] = operations
    integration["execution_classes"] = execution_classes
    integration["manifest_registered"] = True
    if integration.get("collector_last_status") is None:
        integration["collector_last_status"] = "PENDING"
    integration["stage"] = _advance_stage(integration, manifest=True)
    await session.execute(
        text(
            """
            UPDATE catalogue_provider
            SET integration = CAST(:i AS JSONB), updated_at = now()
            WHERE tenant_id = :t AND provider_id = :p
            """
        ),
        {"i": json.dumps(integration), "t": ctx.tenant_id, "p": provider_id},
    )
    row["integration"] = integration
    return _provider_row(row)


async def transition_provider(
    session: AsyncSession,
    ctx: TenantContext,
    provider_id: str,
    *,
    status: str,
) -> dict:
    status = status.strip().lower()
    if status not in ("active", "suspended"):
        raise ValidationFailed(field_errors={"status": "Must be active or suspended."})
    if not authz.get().has_permission(ctx, "provider:state:transition"):
        raise Forbidden(detail="Missing permission provider:state:transition.")
    row = await _get_provider_row(session, ctx, provider_id)
    current = row["status"]
    allowed = CATALOGUE_TRANSITIONS.get(current, frozenset())
    if status not in allowed:
        raise InvalidStateTransition(detail=f"Cannot move provider from {current} to {status}.")
    integration = _integration(row.get("integration"))
    if status == "active" and not integration.get("manifest_registered"):
        raise InvalidStateTransition(detail="Publish a manifest before activating.")
    await session.execute(
        text(
            """
            UPDATE catalogue_provider
            SET status = :s, updated_at = now()
            WHERE tenant_id = :t AND provider_id = :p
            """
        ),
        {"s": status, "t": ctx.tenant_id, "p": provider_id},
    )
    row["status"] = status
    return _provider_row(row)
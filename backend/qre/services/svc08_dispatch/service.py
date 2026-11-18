"""Dispatch ICD, attempts, reconciliation, provider job catalogue."""

from __future__ import annotations

import json
from datetime import UTC, datetime

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from qre.core import authz
from qre.core.context import ResourceRef, TenantContext
from qre.core.errors import Forbidden, InvalidStateTransition, QreError, ResourceNotFound, ValidationFailed
from qre.core.ids import is_ulid, new_ulid

DISPATCH_STATES = frozenset(
    {
        "dispatch_authorized",
        "dispatch_unresolved",
        "dispatch_confirmed",
        "dispatch_failed",
    }
)
OPEN_STATES = frozenset({"dispatch_authorized", "dispatch_unresolved"})
RECONCILE_MAP = {
    "confirmed": "dispatch_confirmed",
    "failed": "dispatch_failed",
    "unresolved": "dispatch_unresolved",
}

ICD_DOC = {
    "icd_version": "1.0.0",
    "live_connector": False,
    "reconcile_outcomes": ["confirmed", "failed", "unresolved"],
    "required_fields": ["workload_id", "backend_id", "attempt_id"],
    "authorize_dispatch": "POST /api/v1/workloads/{workload_id}/authorize-dispatch",
    "record_attempt": "POST /api/v1/workloads/{workload_id}/dispatch-attempts",
    "reconcile": "POST /api/v1/dispatch-attempts/{attempt_id}/reconcile",
    "notes": "Authorize after workload approval. Record attempt before connector retry. Reconcile closes authorized or unresolved attempts.",
}


def _attempt_item(row: dict) -> dict:
    return {
        "attempt_id": row["attempt_id"],
        "workload_id": row["workload_id"],
        "backend_id": row.get("backend_id"),
        "execution_class": row.get("execution_class"),
        "dispatch_state": row["dispatch_state"],
        "external_job_id": row.get("external_job_id"),
        "provider_ref": row.get("provider_ref"),
        "updated_at": row["updated_at"].isoformat() if row.get("updated_at") else None,
    }


def _job_item(row: dict) -> dict:
    return {
        "job_id": row["job_id"],
        "backend_id": row.get("backend_id"),
        "status": row["status"],
        "runtime": row.get("runtime"),
        "failure_category_label": row.get("failure_category_label"),
        "failure_reason": row.get("failure_reason"),
        "submitted_at": row["submitted_at"].isoformat() if row.get("submitted_at") else None,
    }


async def dispatch_icd(ctx: TenantContext) -> dict:
    authz.get().require(ctx, "dispatch:read", ResourceRef.tenant(ctx.tenant_id))
    return dict(ICD_DOC)


async def list_attempts(session: AsyncSession, ctx: TenantContext) -> dict:
    authz.get().require(ctx, "dispatch:read", ResourceRef.tenant(ctx.tenant_id))
    rows = (
        await session.execute(
            text(
                """
                SELECT attempt_id, workload_id, backend_id, execution_class, dispatch_state,
                       external_job_id, provider_ref, updated_at
                FROM dispatch_attempt
                WHERE tenant_id = :t
                ORDER BY updated_at DESC
                """
            ),
            {"t": ctx.tenant_id},
        )
    ).mappings().all()
    return {"items": [_attempt_item(dict(r)) for r in rows]}


async def list_jobs(session: AsyncSession, ctx: TenantContext, *, limit: int = 50) -> dict:
    authz.get().require(ctx, "dispatch:read", ResourceRef.tenant(ctx.tenant_id))
    lim = max(1, min(limit, 200))
    rows = (
        await session.execute(
            text(
                """
                SELECT job_id, backend_id, status, runtime, failure_category_label,
                       failure_reason, submitted_at
                FROM provider_job
                WHERE tenant_id = :t
                ORDER BY submitted_at DESC
                LIMIT :lim
                """
            ),
            {"t": ctx.tenant_id, "lim": lim},
        )
    ).mappings().all()
    return {"items": [_job_item(dict(r)) for r in rows]}


async def get_job(session: AsyncSession, ctx: TenantContext, job_id: str) -> dict:
    authz.get().require(ctx, "dispatch:read", ResourceRef.tenant(ctx.tenant_id))
    row = (
        await session.execute(
            text(
                """
                SELECT job_id, backend_id, status, runtime, failure_category_label,
                       failure_reason, submitted_at, timeline
                FROM provider_job
                WHERE tenant_id = :t AND job_id = :j
                """
            ),
            {"t": ctx.tenant_id, "j": job_id},
        )
    ).mappings().first()
    if not row:
        raise ResourceNotFound()
    out = _job_item(dict(row))
    timeline = row.get("timeline") or []
    if isinstance(timeline, str):
        timeline = json.loads(timeline)
    out["timeline"] = timeline if isinstance(timeline, list) else []
    return out


async def _workload_row(session: AsyncSession, ctx: TenantContext, workload_id: str) -> dict:
    row = (
        await session.execute(
            text(
                """
                SELECT workload_id, tenant_id, project_id, governance_state, metadata
                FROM workload WHERE workload_id = :id
                """
            ),
            {"id": workload_id},
        )
    ).mappings().first()
    if not row or row["tenant_id"] != ctx.tenant_id:
        raise ResourceNotFound()
    return dict(row)


async def _open_attempt(session: AsyncSession, workload_id: str) -> dict | None:
    open_list = ", ".join(f"'{s}'" for s in OPEN_STATES)
    row = (
        await session.execute(
            text(
                f"""
                SELECT attempt_id, dispatch_state
                FROM dispatch_attempt
                WHERE workload_id = :w AND dispatch_state IN ({open_list})
                ORDER BY updated_at DESC
                LIMIT 1
                """
            ),
            {"w": workload_id},
        )
    ).mappings().first()
    return dict(row) if row else None


async def _assert_backend_dispatchable(
    session: AsyncSession, ctx: TenantContext, backend_id: str
) -> str:
    row = (
        await session.execute(
            text(
                """
                SELECT b.operational_status, b.provider_id, p.status AS provider_status
                FROM catalogue_backend b
                LEFT JOIN catalogue_provider p
                  ON p.tenant_id = b.tenant_id AND p.provider_id = b.provider_id
                WHERE b.tenant_id = :t AND b.backend_id = :b
                """
            ),
            {"t": ctx.tenant_id, "b": backend_id},
        )
    ).mappings().first()
    if not row:
        raise ValidationFailed(field_errors={"backend_id": "Unknown backend."})
    if str(row["operational_status"]) != "ONLINE":
        raise QreError(code="BACKEND_UNAVAILABLE", detail="Backend is not ONLINE.")
    if row.get("provider_status") == "suspended":
        raise QreError(code="PROVIDER_SUSPENDED")
    return str(row["provider_id"] or "")


async def authorize_dispatch(
    session: AsyncSession,
    ctx: TenantContext,
    workload_id: str,
    *,
    backend_id: str,
) -> dict:
    if not is_ulid(workload_id):
        raise ValidationFailed(field_errors={"workload_id": "Invalid id."})
    wl = await _workload_row(session, ctx, workload_id)
    authz.get().require(
        ctx, "workload:authorize", ResourceRef.project(ctx.tenant_id, wl["project_id"])
    )
    if wl["governance_state"] != "approved":
        raise QreError(code="WORKLOAD_NOT_AUTHORIZED", detail="Workload is not approved.")
    if await _open_attempt(session, workload_id):
        raise QreError(code="DISPATCH_IN_PROGRESS")
    unresolved = (
        await session.execute(
            text(
                """
                SELECT 1 FROM dispatch_attempt
                WHERE workload_id = :w AND dispatch_state = 'dispatch_unresolved'
                LIMIT 1
                """
            ),
            {"w": workload_id},
        )
    ).first()
    if unresolved:
        raise QreError(code="DISPATCH_UNRESOLVED")
    provider_ref = await _assert_backend_dispatchable(session, ctx, backend_id)
    meta = wl.get("metadata") or {}
    if isinstance(meta, str):
        meta = json.loads(meta)
    exec_class = str(meta.get("execution_class") or "simulated")
    aid = new_ulid()
    await session.execute(
        text(
            """
            INSERT INTO dispatch_attempt (
                attempt_id, tenant_id, workload_id, backend_id, execution_class,
                dispatch_state, provider_ref
            ) VALUES (:id, :t, :w, :b, :ec, 'dispatch_authorized', :pref)
            """
        ),
        {
            "id": aid,
            "t": ctx.tenant_id,
            "w": workload_id,
            "b": backend_id.strip(),
            "ec": exec_class,
            "pref": provider_ref or None,
        },
    )
    row = (
        await session.execute(
            text(
                """
                SELECT attempt_id, workload_id, backend_id, execution_class, dispatch_state,
                       external_job_id, provider_ref, updated_at
                FROM dispatch_attempt WHERE attempt_id = :id
                """
            ),
            {"id": aid},
        )
    ).mappings().first()
    return _attempt_item(dict(row))


async def record_attempt(
    session: AsyncSession,
    ctx: TenantContext,
    workload_id: str,
    *,
    backend_id: str,
    execution_class: str | None,
    external_job_id: str | None,
) -> dict:
    if not is_ulid(workload_id):
        raise ValidationFailed(field_errors={"workload_id": "Invalid id."})
    wl = await _workload_row(session, ctx, workload_id)
    authz.get().require(
        ctx, "workload:dispatch", ResourceRef.project(ctx.tenant_id, wl["project_id"])
    )
    if wl["governance_state"] != "approved":
        raise QreError(code="WORKLOAD_NOT_AUTHORIZED")
    open_row = await _open_attempt(session, workload_id)
    provider_ref = await _assert_backend_dispatchable(session, ctx, backend_id)
    meta = wl.get("metadata") or {}
    if isinstance(meta, str):
        meta = json.loads(meta)
    exec_class = execution_class or str(meta.get("execution_class") or "simulated")
    if open_row and open_row["dispatch_state"] == "dispatch_authorized":
        aid = open_row["attempt_id"]
        await session.execute(
            text(
                """
                UPDATE dispatch_attempt
                SET backend_id = :b, execution_class = :ec, external_job_id = :ext,
                    provider_ref = :pref, dispatch_state = 'dispatch_unresolved',
                    updated_at = now()
                WHERE attempt_id = :id
                """
            ),
            {
                "b": backend_id.strip(),
                "ec": exec_class,
                "ext": external_job_id,
                "pref": provider_ref or None,
                "id": aid,
            },
        )
    else:
        if open_row:
            raise QreError(code="DISPATCH_IN_PROGRESS")
        aid = new_ulid()
        await session.execute(
            text(
                """
                INSERT INTO dispatch_attempt (
                    attempt_id, tenant_id, workload_id, backend_id, execution_class,
                    dispatch_state, external_job_id, provider_ref
                ) VALUES (
                    :id, :t, :w, :b, :ec, 'dispatch_unresolved', :ext, :pref
                )
                """
            ),
            {
                "id": aid,
                "t": ctx.tenant_id,
                "w": workload_id,
                "b": backend_id.strip(),
                "ec": exec_class,
                "ext": external_job_id,
                "pref": provider_ref or None,
            },
        )
    row = (
        await session.execute(
            text(
                """
                SELECT attempt_id, workload_id, backend_id, execution_class, dispatch_state,
                       external_job_id, provider_ref, updated_at
                FROM dispatch_attempt WHERE attempt_id = :id
                """
            ),
            {"id": aid},
        )
    ).mappings().first()
    return _attempt_item(dict(row))


async def reconcile_attempt(
    session: AsyncSession,
    ctx: TenantContext,
    attempt_id: str,
    *,
    outcome: str,
    reason: str,
) -> dict:
    if not authz.get().has_permission(ctx, "dispatch:reconcile"):
        raise Forbidden(detail="Missing permission dispatch:reconcile.")
    authz.get().require(ctx, "dispatch:read", ResourceRef.tenant(ctx.tenant_id))
    new_state = RECONCILE_MAP.get(outcome)
    if not new_state:
        raise ValidationFailed(field_errors={"outcome": "Invalid outcome."})
    row = (
        await session.execute(
            text(
                """
                SELECT attempt_id, tenant_id, workload_id, backend_id, dispatch_state,
                       external_job_id
                FROM dispatch_attempt
                WHERE attempt_id = :id
                """
            ),
            {"id": attempt_id},
        )
    ).mappings().first()
    if not row or row["tenant_id"] != ctx.tenant_id:
        raise ResourceNotFound()
    current = row["dispatch_state"]
    if current not in OPEN_STATES:
        raise InvalidStateTransition(detail="Attempt is already closed.")
    await session.execute(
        text(
            """
            UPDATE dispatch_attempt
            SET dispatch_state = :st, reconcile_reason = :r, updated_at = now()
            WHERE attempt_id = :id
            """
        ),
        {"st": new_state, "r": reason or outcome, "id": attempt_id},
    )
    if new_state == "dispatch_confirmed" and row.get("external_job_id"):
        job_id = row["external_job_id"]
        await session.execute(
            text(
                """
                INSERT INTO provider_job (
                    tenant_id, job_id, backend_id, status, runtime, submitted_at
                ) VALUES (
                    :t, :j, :b, 'COMPLETED', '—', now()
                )
                ON CONFLICT (tenant_id, job_id) DO UPDATE
                SET status = 'COMPLETED', backend_id = EXCLUDED.backend_id, updated_at = now()
                """
            ),
            {"t": ctx.tenant_id, "j": job_id, "b": row.get("backend_id")},
        )
    elif new_state == "dispatch_failed" and row.get("external_job_id"):
        await session.execute(
            text(
                """
                INSERT INTO provider_job (
                    tenant_id, job_id, backend_id, status, failure_category_label,
                    failure_reason, submitted_at
                ) VALUES (
                    :t, :j, :b, 'FAILED', 'reconciled', :r, now()
                )
                ON CONFLICT (tenant_id, job_id) DO UPDATE
                SET status = 'FAILED', failure_reason = EXCLUDED.failure_reason, updated_at = now()
                """
            ),
            {
                "t": ctx.tenant_id,
                "j": row["external_job_id"],
                "b": row.get("backend_id"),
                "r": reason or outcome,
            },
        )
    updated = (
        await session.execute(
            text(
                """
                SELECT attempt_id, workload_id, backend_id, execution_class, dispatch_state,
                       external_job_id, provider_ref, updated_at
                FROM dispatch_attempt WHERE attempt_id = :id
                """
            ),
            {"id": attempt_id},
        )
    ).mappings().first()
    return _attempt_item(dict(updated))
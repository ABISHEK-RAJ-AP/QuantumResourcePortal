"""Lab module surfaces the SPA already calls.

Returns honest empty payloads (200) so Overview/chrome show empty states instead of 404 noise.
Real service slices replace these routes over time; keep shapes stable for the React clients.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query

from qre.core.context import TenantContext
from qre.core.deps import get_ctx

router = APIRouter(tags=["lab-modules"])


def _now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


@router.get("/governance/summary")
async def governance_summary(ctx: TenantContext = Depends(get_ctx)) -> dict:
    return {
        "counts": {
            "submitted_for_review": 0,
            "in_review": 0,
            "changes_requested": 0,
            "rejected": 0,
            "approved": 0,
            "withdrawn": 0,
        },
        "queue": 0,
        "providers_active": 0,
        "providers_total": 0,
        "inventory_assets": 0,
        "meter_samples_24h": 0,
        "source": "lab_empty",
        "tenant_id": ctx.tenant_id,
        "generated_at": _now(),
    }


@router.get("/governance/activity")
async def governance_activity(
    ctx: TenantContext = Depends(get_ctx),
    limit: int = Query(8, ge=1, le=100),
) -> dict:
    return {"items": [], "limit": limit, "tenant_id": ctx.tenant_id, "generated_at": _now()}


@router.get("/operations/centre")
async def operations_centre(ctx: TenantContext = Depends(get_ctx)) -> dict:
    return {
        "fleet": {"total": 0, "online": 0, "offline": 0, "simulated_catalog": 0},
        "operations": {"active_alerts": 0, "open_incidents": 0},
        "platform": {"platform_data_mode": "lab", "database_storage": "postgres"},
        "queues": [],
        "generated_at": _now(),
        "tenant_id": ctx.tenant_id,
        "source": "lab_empty",
    }


@router.get("/quotas/ledger")
async def quotas_ledger(
    ctx: TenantContext = Depends(get_ctx),
    window: str = Query("today"),
    project_id: str | None = None,
) -> dict:
    return {
        "window": window,
        "project_id": project_id,
        "used_shots": 0,
        "remaining_shots": 0,
        "daily_shots_cap": 0,
        "tenant_id": ctx.tenant_id,
        "source": "lab_empty",
        "generated_at": _now(),
    }


@router.get("/dispatch-attempts")
async def dispatch_attempts(ctx: TenantContext = Depends(get_ctx)) -> dict:
    return {"items": [], "tenant_id": ctx.tenant_id, "generated_at": _now()}


@router.get("/alerts/summary")
async def alerts_summary(ctx: TenantContext = Depends(get_ctx)) -> dict:
    return {
        "active": 0,
        "critical": 0,
        "warning": 0,
        "stored": 0,
        "by_backend": {},
        "critical_by_backend": {},
        "warning_by_backend": {},
        "tenant_id": ctx.tenant_id,
        "generated_at": _now(),
    }


@router.get("/approvals")
async def approvals_list(
    ctx: TenantContext = Depends(get_ctx),
    scope: str | None = Query(None),
) -> dict:
    return {
        "items": [],
        "scope": scope or "all",
        "tenant_id": ctx.tenant_id,
        "generated_at": _now(),
        "source": "lab_empty",
    }

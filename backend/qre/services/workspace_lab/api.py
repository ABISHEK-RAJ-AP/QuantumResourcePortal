"""Lab workspace read models until governance modules ship (inventory, approvals, …).

Returns illustrative aggregates so the Home dashboard and dock are not empty in demos.
Disabled outside QRE_ENV=lab — production must use real module routers.
"""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Query

from qre.core.deps import get_ctx, require_permission

router = APIRouter(tags=["workspace-lab"])

_DEMO_NOW = datetime.now(UTC).isoformat()


@router.get("/governance/summary")
async def governance_summary(ctx=Depends(require_permission("governance:read"))):
    _ = ctx
    return {
        "queue": 3,
        "in_review": 2,
        "inventory_assets": 12,
        "counts": {
            "submitted_for_review": 1,
            "in_review": 2,
            "approved": 5,
            "rejected": 1,
            "withdrawn": 0,
        },
        "demo": True,
        "label": "Lab preview data — module APIs not fully deployed",
    }


@router.get("/operations/centre")
async def operations_centre(ctx=Depends(require_permission("governance:read"))):
    _ = ctx
    return {
        "operations": {"open_incidents": 1, "active_alerts": 4},
        "fleet": {"online": 3, "total": 4, "degraded": 1},
        "demo": True,
    }


@router.get("/quotas/ledger")
async def quotas_ledger(ctx=Depends(require_permission("governance:read"))):
    _ = ctx
    return {
        "daily_shots_cap": 1000,
        "used_shots": 340,
        "remaining_shots": 660,
        "demo": True,
    }


@router.get("/queues")
async def queues_overview(ctx=Depends(require_permission("governance:read"))):
    _ = ctx
    return {
        "items": [
            {"queue_id": "q_sim", "name": "Simulator pool", "pending_jobs": 2, "status": "active"},
            {"queue_id": "q_qpu", "name": "QPU dispatch", "pending_jobs": 1, "status": "active"},
        ]
    }


@router.get("/dispatch-attempts")
async def dispatch_attempts(ctx=Depends(require_permission("governance:read"))):
    _ = ctx
    return {
        "items": [
            {
                "attempt_id": "da_demo_1",
                "dispatch_state": "dispatch_unresolved",
                "provider_ref": "ibm_qasm_sim",
                "updated_at": _DEMO_NOW,
            }
        ]
    }


@router.get("/alerts/summary")
async def alerts_summary(ctx=Depends(require_permission("governance:read"))):
    _ = ctx
    return {
        "active": 4,
        "critical": 1,
        "by_backend": {"sim_backend_a": 2, "qpu_backend_b": 2},
        "demo": True,
    }


@router.get("/governance/activity")
async def governance_activity(
    ctx=Depends(require_permission("governance:read")),
    limit: int = Query(8, ge=1, le=50),
):
    _ = ctx
    rows = [
        {"action": "approval.submitted", "actor": "user_researcher", "at": _DEMO_NOW},
        {"action": "approval.in_review", "actor": "approver", "at": _DEMO_NOW},
        {"action": "quota.evaluated", "actor": "system", "at": _DEMO_NOW},
    ]
    return {"items": rows[:limit], "demo": True}


@router.get("/approvals")
async def approvals_list(
    ctx=Depends(require_permission("approval:read")),
    scope: str | None = None,
    state: str | None = None,
    project_id: str | None = None,
):
    _ = ctx
    _ = project_id
    items = [
        {
            "approval_id": "apr_demo_1",
            "state": "in_review",
            "project_id": "prj_demo",
            "submitter": "user_researcher",
            "stage": "policy",
        },
        {
            "approval_id": "apr_demo_2",
            "state": "submitted_for_review",
            "project_id": "prj_demo_2",
            "submitter": "user_analyst",
            "stage": "technical",
        },
        {
            "approval_id": "apr_demo_3",
            "state": "approved",
            "project_id": "prj_demo_3",
            "submitter": "user_researcher",
            "stage": "quota",
        },
    ]
    if scope == "mine":
        items = [items[0]]
    elif state:
        items = [i for i in items if i["state"] == state]
    return {"items": items, "demo": True}
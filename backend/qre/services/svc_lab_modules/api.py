"""Lab demo module surfaces — rich in-memory catalogue for walkthroughs.

Real service slices replace these routes over time; keep response shapes stable.
"""

from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Body, Depends, HTTPException, Query

from qre.core.context import TenantContext
from qre.core.deps import get_ctx
from qre.services.svc_lab_modules.demo_data import demo, items

router = APIRouter(tags=["lab-modules"])


def _now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _d(ctx: TenantContext) -> dict:
    return demo(ctx.tenant_id)


def _find(rows: list[dict], key: str, value: str) -> dict | None:
    for row in rows:
        if str(row.get(key) or "") == value:
            return row
    return None


def _ok(payload: dict | None = None, **extra: Any) -> dict:
    out = {"ok": True, "source": "lab_demo", "generated_at": _now()}
    if payload:
        out.update(payload)
    out.update(extra)
    return out


# ── Governance / Overview ────────────────────────────────────────────────────


@router.get("/governance/summary")
async def governance_summary(ctx: TenantContext = Depends(get_ctx)) -> dict:
    return deepcopy(_d(ctx)["summary"])


@router.get("/governance/activity")
async def governance_activity(
    ctx: TenantContext = Depends(get_ctx),
    limit: int = Query(8, ge=1, le=100),
    project_id: str | None = None,
) -> dict:
    rows = list(_d(ctx)["activity"])
    if project_id:
        # Soft filter: keep rows whose target workload belongs to project
        wl = {a["workload_id"] for a in _d(ctx)["approvals"] if a.get("project_id") == project_id}
        rows = [r for r in rows if r.get("target_id") in wl]
    return {"items": rows[:limit], "limit": limit, "tenant_id": ctx.tenant_id, "generated_at": _now()}


@router.get("/governance/institution-boundary")
async def institution_boundary(ctx: TenantContext = Depends(get_ctx)) -> dict:
    return {
        "tenant_id": ctx.tenant_id,
        "institution": "C-DAC Demo Lab",
        "boundary": "lab",
        "data_residency": "IN",
        "source": "lab_demo",
        "generated_at": _now(),
    }


@router.get("/operations/centre")
async def operations_centre(ctx: TenantContext = Depends(get_ctx)) -> dict:
    d = _d(ctx)
    backends = d["backends"]
    online = sum(1 for b in backends if b.get("operational_status") == "ONLINE")
    alerts = [a for a in d["alerts"] if a.get("status") == "ACTIVE"]
    return {
        "fleet": {
            "total": len(backends),
            "online": online,
            "offline": len(backends) - online,
            "simulated_catalog": sum(1 for b in backends if b.get("qpu_modality") == "simulator"),
        },
        "operations": {
            "active_alerts": len(alerts),
            "open_incidents": sum(1 for i in d["incidents"] if i.get("status") in ("OPEN", "INVESTIGATING")),
        },
        "platform": {"platform_data_mode": "lab", "database_storage": "postgres"},
        "queues": deepcopy(d["queues"]),
        "generated_at": _now(),
        "tenant_id": ctx.tenant_id,
        "source": "lab_demo",
    }


@router.get("/quotas/ledger")
async def quotas_ledger(
    ctx: TenantContext = Depends(get_ctx),
    window: str = Query("today"),
    project_id: str | None = None,
) -> dict:
    base = deepcopy(_d(ctx)["ledger"])
    base["window"] = window
    base["project_id"] = project_id
    if project_id:
        base["used_shots"] = max(500, int(base["used_shots"] * 0.35))
        base["remaining_shots"] = max(0, base["daily_shots_cap"] - base["used_shots"])
    return base


@router.get("/quotas/evaluate")
async def quotas_evaluate(
    ctx: TenantContext = Depends(get_ctx),
    workload_id: str | None = None,
) -> dict:
    return {
        "workload_id": workload_id,
        "allowed": True,
        "reason": "Within daily lab cap",
        "remaining_shots": _d(ctx)["ledger"]["remaining_shots"],
        "source": "lab_demo",
        "generated_at": _now(),
    }


@router.get("/meter-rollups")
async def meter_rollups(
    ctx: TenantContext = Depends(get_ctx),
    hours: int = Query(24, ge=1, le=168),
) -> dict:
    points = []
    for i in range(min(hours, 24)):
        points.append(
            {
                "hour_offset": i,
                "shots": 400 + (i * 37) % 900,
                "jobs": 1 + (i % 4),
            }
        )
    return {"hours": hours, "points": points, "tenant_id": ctx.tenant_id, "source": "lab_demo", "generated_at": _now()}


# ── Approvals ────────────────────────────────────────────────────────────────


@router.get("/approvals")
async def approvals_list(
    ctx: TenantContext = Depends(get_ctx),
    scope: str | None = Query(None),
    state: str | None = Query(None),
    project_id: str | None = Query(None),
) -> dict:
    rows = list(_d(ctx)["approvals"])
    if project_id:
        rows = [r for r in rows if r.get("project_id") == project_id]
    if scope == "mine":
        rows = [r for r in rows if r.get("created_by") in ("admin", "researcher")]
    if state:
        rows = [r for r in rows if r.get("governance_state") == state]
    elif scope != "mine" and not project_id and not state:
        # Default queue: needs attention
        rows = [r for r in rows if r.get("governance_state") in ("submitted_for_review", "in_review", "changes_requested")]
    return {
        "items": rows,
        "scope": scope or "all",
        "tenant_id": ctx.tenant_id,
        "generated_at": _now(),
        "source": "lab_demo",
    }


@router.get("/approvals/policy")
async def approvals_policy(ctx: TenantContext = Depends(get_ctx)) -> dict:
    return deepcopy(_d(ctx)["policy"])


@router.get("/approvals/{workload_id}")
async def approval_detail(workload_id: str, ctx: TenantContext = Depends(get_ctx)) -> dict:
    row = _find(_d(ctx)["approvals"], "workload_id", workload_id)
    if not row:
        raise HTTPException(404, detail="Approval not found")
    out = deepcopy(row)
    out["history"] = [
        {
            "at": row.get("created_at"),
            "actor": row.get("created_by"),
            "action": "SUBMITTED",
            "note": "Submitted for review",
        },
        {
            "at": row.get("updated_at"),
            "actor": "system",
            "action": "STATE",
            "note": f"Current: {row.get('governance_state')}",
        },
    ]
    out["source"] = "lab_demo"
    return out


@router.post("/approvals/{workload_id}/decide")
async def approval_decide(
    workload_id: str,
    body: dict = Body(default_factory=dict),
    ctx: TenantContext = Depends(get_ctx),
) -> dict:
    row = _find(_d(ctx)["approvals"], "workload_id", workload_id)
    if not row:
        raise HTTPException(404, detail="Approval not found")
    decision = str(body.get("decision") or body.get("outcome") or "approved").lower()
    mapping = {
        "approve": "approved",
        "approved": "approved",
        "reject": "rejected",
        "rejected": "rejected",
        "changes_requested": "changes_requested",
        "request_changes": "changes_requested",
    }
    row["governance_state"] = mapping.get(decision, "approved")
    row["updated_at"] = _now()
    return _ok({"workload_id": workload_id, "governance_state": row["governance_state"]})


@router.post("/approvals/{workload_id}/withdraw")
async def approval_withdraw(workload_id: str, ctx: TenantContext = Depends(get_ctx)) -> dict:
    row = _find(_d(ctx)["approvals"], "workload_id", workload_id)
    if not row:
        raise HTTPException(404, detail="Approval not found")
    row["governance_state"] = "withdrawn"
    row["updated_at"] = _now()
    return _ok({"workload_id": workload_id, "governance_state": "withdrawn"})


# ── Dispatch / jobs / queues / backends ──────────────────────────────────────


@router.get("/dispatch-attempts")
async def dispatch_attempts(ctx: TenantContext = Depends(get_ctx)) -> dict:
    return items(_d(ctx)["attempts"]) | {"tenant_id": ctx.tenant_id, "generated_at": _now()}


@router.post("/dispatch-attempts/{attempt_id}/reconcile")
async def reconcile_attempt(attempt_id: str, ctx: TenantContext = Depends(get_ctx)) -> dict:
    row = _find(_d(ctx)["attempts"], "attempt_id", attempt_id)
    if not row:
        raise HTTPException(404, detail="Attempt not found")
    row["dispatch_state"] = "dispatch_confirmed"
    row["message"] = "Reconciled in lab demo"
    return _ok({"attempt_id": attempt_id, "dispatch_state": row["dispatch_state"]})


@router.get("/dispatch-icd")
async def dispatch_icd(ctx: TenantContext = Depends(get_ctx)) -> dict:
    return {
        "version": "1.0",
        "connectors": [c["name"] for c in _d(ctx)["connectors"]],
        "states": [
            "dispatch_authorized",
            "dispatch_confirmed",
            "dispatch_unresolved",
            "dispatch_failed",
        ],
        "tenant_id": ctx.tenant_id,
        "source": "lab_demo",
        "generated_at": _now(),
    }


@router.get("/jobs")
async def jobs_list(
    ctx: TenantContext = Depends(get_ctx),
    limit: int = Query(50, ge=1, le=200),
) -> dict:
    return items(_d(ctx)["jobs"][:limit]) | {"tenant_id": ctx.tenant_id, "generated_at": _now()}


@router.get("/jobs/{job_id}")
async def job_detail(job_id: str, ctx: TenantContext = Depends(get_ctx)) -> dict:
    row = _find(_d(ctx)["jobs"], "job_id", job_id)
    if not row:
        raise HTTPException(404, detail="Job not found")
    return deepcopy(row) | {"source": "lab_demo", "generated_at": _now()}


@router.get("/queues")
async def queues_list(ctx: TenantContext = Depends(get_ctx)) -> dict:
    return items(_d(ctx)["queues"]) | {"tenant_id": ctx.tenant_id, "generated_at": _now()}


@router.get("/queues/{backend_id}")
async def queue_detail(backend_id: str, ctx: TenantContext = Depends(get_ctx)) -> dict:
    row = _find(_d(ctx)["queues"], "backend_id", backend_id)
    if not row:
        raise HTTPException(404, detail="Queue not found")
    return deepcopy(row) | {"source": "lab_demo", "generated_at": _now()}


@router.get("/backends")
async def backends_list(ctx: TenantContext = Depends(get_ctx)) -> dict:
    return items(_d(ctx)["backends"]) | {"tenant_id": ctx.tenant_id, "generated_at": _now()}


@router.get("/backends/{backend_id}")
async def backend_detail(backend_id: str, ctx: TenantContext = Depends(get_ctx)) -> dict:
    row = _find(_d(ctx)["backends"], "backend_id", backend_id)
    if not row:
        raise HTTPException(404, detail="Backend not found")
    return deepcopy(row) | {"source": "lab_demo", "generated_at": _now()}


@router.get("/backends/{backend_id}/status")
async def backend_status(backend_id: str, ctx: TenantContext = Depends(get_ctx)) -> dict:
    row = _find(_d(ctx)["backends"], "backend_id", backend_id)
    if not row:
        raise HTTPException(404, detail="Backend not found")
    return {
        "backend_id": backend_id,
        "operational_status": row.get("operational_status"),
        "queue_depth": row.get("queue_depth"),
        "last_heartbeat": _now(),
        "source": "lab_demo",
    }


@router.get("/backends/{backend_id}/topology")
async def backend_topology(backend_id: str, ctx: TenantContext = Depends(get_ctx)) -> dict:
    row = _find(_d(ctx)["backends"], "backend_id", backend_id)
    if not row:
        raise HTTPException(404, detail="Backend not found")
    n = int(row.get("qubits") or 4)
    return {
        "backend_id": backend_id,
        "qubits": n,
        "coupling_map": [[i, i + 1] for i in range(max(0, n - 1))],
        "source": "lab_demo",
    }


# ── Alerts / incidents ───────────────────────────────────────────────────────


@router.get("/alerts/summary")
async def alerts_summary(ctx: TenantContext = Depends(get_ctx)) -> dict:
    alerts = _d(ctx)["alerts"]
    active = [a for a in alerts if a.get("status") in ("ACTIVE", "ACKNOWLEDGED")]
    by_backend: dict[str, int] = {}
    critical_by: dict[str, int] = {}
    warning_by: dict[str, int] = {}
    for a in active:
        rid = str(a.get("resource_id") or "unknown")
        by_backend[rid] = by_backend.get(rid, 0) + 1
        if a.get("severity") == "CRITICAL":
            critical_by[rid] = critical_by.get(rid, 0) + 1
        elif a.get("severity") == "WARNING":
            warning_by[rid] = warning_by.get(rid, 0) + 1
    return {
        "active": len([a for a in active if a.get("status") == "ACTIVE"]),
        "critical": sum(1 for a in active if a.get("severity") == "CRITICAL"),
        "warning": sum(1 for a in active if a.get("severity") == "WARNING"),
        "stored": len(alerts),
        "by_backend": by_backend,
        "critical_by_backend": critical_by,
        "warning_by_backend": warning_by,
        "tenant_id": ctx.tenant_id,
        "generated_at": _now(),
    }


@router.get("/alerts")
async def alerts_list(
    ctx: TenantContext = Depends(get_ctx),
    resource_id: str | None = None,
    limit: int = Query(50, ge=1, le=200),
) -> dict:
    rows = list(_d(ctx)["alerts"])
    if resource_id:
        rows = [r for r in rows if r.get("resource_id") == resource_id]
    return items(rows[:limit]) | {"tenant_id": ctx.tenant_id, "generated_at": _now()}


@router.get("/alerts/{alert_id}")
async def alert_detail(alert_id: str, ctx: TenantContext = Depends(get_ctx)) -> dict:
    row = _find(_d(ctx)["alerts"], "alert_id", alert_id)
    if not row:
        raise HTTPException(404, detail="Alert not found")
    out = deepcopy(row)
    out["comments"] = [
        {"at": row.get("detected_at"), "actor": "system", "body": "Auto-detected from telemetry"},
    ]
    out["incident_id"] = "inc-1" if row.get("severity") == "CRITICAL" else None
    out["backend_id"] = row.get("resource_id") if str(row.get("resource_id", "")).startswith("cdac") else None
    return out | {"source": "lab_demo"}


@router.post("/alerts/{alert_id}/{action}")
async def alert_action(alert_id: str, action: str, ctx: TenantContext = Depends(get_ctx)) -> dict:
    row = _find(_d(ctx)["alerts"], "alert_id", alert_id)
    if not row:
        raise HTTPException(404, detail="Alert not found")
    if action in ("acknowledge", "ack"):
        row["status"] = "ACKNOWLEDGED"
    elif action in ("resolve", "close"):
        row["status"] = "RESOLVED"
    elif action == "reopen":
        row["status"] = "ACTIVE"
    return _ok({"alert_id": alert_id, "status": row["status"], "action": action})


@router.post("/alerts/{alert_id}/comments")
async def alert_comment(
    alert_id: str,
    body: dict = Body(default_factory=dict),
    ctx: TenantContext = Depends(get_ctx),
) -> dict:
    if not _find(_d(ctx)["alerts"], "alert_id", alert_id):
        raise HTTPException(404, detail="Alert not found")
    return _ok({"alert_id": alert_id, "comment": body.get("body") or body.get("comment") or ""})


@router.get("/incidents")
async def incidents_list(
    ctx: TenantContext = Depends(get_ctx),
    limit: int = Query(50, ge=1, le=200),
) -> dict:
    return items(_d(ctx)["incidents"][:limit]) | {"tenant_id": ctx.tenant_id, "generated_at": _now()}


@router.get("/incidents/{incident_id}")
async def incident_detail(incident_id: str, ctx: TenantContext = Depends(get_ctx)) -> dict:
    row = _find(_d(ctx)["incidents"], "incident_id", incident_id)
    if not row:
        raise HTTPException(404, detail="Incident not found")
    return deepcopy(row) | {
        "timeline": [
            {"at": row.get("last_detected_at"), "event": "Detected", "actor": "system"},
        ],
        "source": "lab_demo",
        "generated_at": _now(),
    }


@router.post("/incidents/{incident_id}/{action}")
async def incident_action(incident_id: str, action: str, ctx: TenantContext = Depends(get_ctx)) -> dict:
    row = _find(_d(ctx)["incidents"], "incident_id", incident_id)
    if not row:
        raise HTTPException(404, detail="Incident not found")
    if action in ("acknowledge", "investigate"):
        row["status"] = "INVESTIGATING"
    elif action in ("resolve", "close"):
        row["status"] = "RESOLVED"
    elif action == "reopen":
        row["status"] = "OPEN"
    return _ok({"incident_id": incident_id, "status": row["status"], "action": action})


# ── Projects / reservations / inventory ──────────────────────────────────────


@router.get("/projects")
async def projects_list(ctx: TenantContext = Depends(get_ctx)) -> dict:
    return items(_d(ctx)["projects"]) | {"tenant_id": ctx.tenant_id, "generated_at": _now()}


@router.post("/projects")
async def projects_create(body: dict = Body(default_factory=dict), ctx: TenantContext = Depends(get_ctx)) -> dict:
    pid = f"prj-{uuid4().hex[:6]}"
    row = {
        "project_id": pid,
        "code": str(body.get("code") or "NEW")[:8].upper(),
        "name": str(body.get("name") or "New project"),
        "status": "ACTIVE",
        "member_count": 1,
    }
    _d(ctx)["projects"].append(row)
    return deepcopy(row)


@router.get("/projects/{project_id}")
async def project_detail(project_id: str, ctx: TenantContext = Depends(get_ctx)) -> dict:
    row = _find(_d(ctx)["projects"], "project_id", project_id)
    if not row:
        raise HTTPException(404, detail="Project not found")
    return deepcopy(row) | {"source": "lab_demo"}


@router.get("/projects/{project_id}/members")
async def project_members(project_id: str, ctx: TenantContext = Depends(get_ctx)) -> dict:
    if not _find(_d(ctx)["projects"], "project_id", project_id):
        raise HTTPException(404, detail="Project not found")
    return items(
        [
            {"username": "admin", "role": "owner"},
            {"username": "researcher", "role": "member"},
            {"username": "reviewer", "role": "reviewer"},
        ]
    )


@router.post("/projects/{project_id}/members")
async def project_members_add(
    project_id: str,
    body: dict = Body(default_factory=dict),
    ctx: TenantContext = Depends(get_ctx),
) -> dict:
    if not _find(_d(ctx)["projects"], "project_id", project_id):
        raise HTTPException(404, detail="Project not found")
    return _ok({"project_id": project_id, "username": body.get("username"), "role": body.get("role") or "member"})


@router.get("/reservations")
async def reservations_list(
    ctx: TenantContext = Depends(get_ctx),
    project_id: str | None = None,
) -> dict:
    rows = list(_d(ctx)["reservations"])
    if project_id:
        rows = [r for r in rows if r.get("project_id") == project_id]
    return items(rows) | {"tenant_id": ctx.tenant_id, "generated_at": _now()}


@router.post("/reservations")
async def reservations_create(body: dict = Body(default_factory=dict), ctx: TenantContext = Depends(get_ctx)) -> dict:
    rid = f"rsv-{uuid4().hex[:6]}"
    row = {
        "reservation_id": rid,
        "project_id": body.get("project_id") or "prj-lab",
        "backend_id": body.get("backend_id") or "sim-aer-local",
        "status": "confirmed",
        "starts_at": body.get("starts_at") or _now(),
        "ends_at": body.get("ends_at") or _now(),
    }
    _d(ctx)["reservations"].append(row)
    return deepcopy(row)


@router.post("/reservations/{reservation_id}/transition")
async def reservation_transition(
    reservation_id: str,
    body: dict = Body(default_factory=dict),
    ctx: TenantContext = Depends(get_ctx),
) -> dict:
    row = _find(_d(ctx)["reservations"], "reservation_id", reservation_id)
    if not row:
        raise HTTPException(404, detail="Reservation not found")
    row["status"] = str(body.get("status") or body.get("to") or "confirmed")
    return _ok({"reservation_id": reservation_id, "status": row["status"]})


@router.get("/inventory/assets")
async def inventory_assets(ctx: TenantContext = Depends(get_ctx)) -> dict:
    rows = list(_d(ctx)["assets"])
    return items(rows) | {"tenant_id": ctx.tenant_id, "generated_at": _now()}


@router.get("/inventory/assets/{asset_id}")
async def inventory_asset(asset_id: str, ctx: TenantContext = Depends(get_ctx)) -> dict:
    row = _find(_d(ctx)["assets"], "asset_id", asset_id)
    if not row:
        raise HTTPException(404, detail="Asset not found")
    return deepcopy(row) | {"source": "lab_demo"}


@router.post("/inventory/assets")
async def inventory_create(body: dict = Body(default_factory=dict), ctx: TenantContext = Depends(get_ctx)) -> dict:
    aid = f"ast-{uuid4().hex[:6]}"
    row = {
        "asset_id": aid,
        "name": body.get("name") or "New asset",
        "lifecycle": "active",
        "execution_class": body.get("execution_class") or "simulator",
        "provider_id": body.get("provider_id") or "prov-sim",
    }
    _d(ctx)["assets"].append(row)
    return deepcopy(row)


@router.post("/inventory/assets/{asset_id}/lifecycle")
async def inventory_lifecycle(
    asset_id: str,
    body: dict = Body(default_factory=dict),
    ctx: TenantContext = Depends(get_ctx),
) -> dict:
    row = _find(_d(ctx)["assets"], "asset_id", asset_id)
    if not row:
        raise HTTPException(404, detail="Asset not found")
    row["lifecycle"] = str(body.get("lifecycle") or body.get("to") or row["lifecycle"])
    return _ok({"asset_id": asset_id, "lifecycle": row["lifecycle"]})


@router.post("/inventory/imports")
async def inventory_import(body: dict = Body(default_factory=dict), ctx: TenantContext = Depends(get_ctx)) -> dict:
    return _ok({"imported": 1, "payload_keys": list(body.keys())})


# ── Providers / pools / connectors ───────────────────────────────────────────


@router.get("/providers")
async def providers_list(ctx: TenantContext = Depends(get_ctx)) -> dict:
    return items(_d(ctx)["providers"]) | {"tenant_id": ctx.tenant_id, "generated_at": _now()}


@router.post("/providers/{provider_id}/onboarding")
async def provider_onboarding(provider_id: str, ctx: TenantContext = Depends(get_ctx)) -> dict:
    row = _find(_d(ctx)["providers"], "provider_id", provider_id)
    if not row:
        raise HTTPException(404, detail="Provider not found")
    row["stage"] = "onboarding"
    return _ok({"provider_id": provider_id, "stage": "onboarding"})


@router.post("/providers/{provider_id}/transition")
async def provider_transition(
    provider_id: str,
    body: dict = Body(default_factory=dict),
    ctx: TenantContext = Depends(get_ctx),
) -> dict:
    row = _find(_d(ctx)["providers"], "provider_id", provider_id)
    if not row:
        raise HTTPException(404, detail="Provider not found")
    row["stage"] = str(body.get("stage") or body.get("to") or "live")
    return _ok({"provider_id": provider_id, "stage": row["stage"]})


@router.get("/virtual-pools")
async def pools_list(ctx: TenantContext = Depends(get_ctx)) -> dict:
    return items(_d(ctx)["pools"]) | {"tenant_id": ctx.tenant_id, "generated_at": _now()}


@router.post("/virtual-pools")
async def pools_create(body: dict = Body(default_factory=dict), ctx: TenantContext = Depends(get_ctx)) -> dict:
    pid = f"pool-{uuid4().hex[:6]}"
    row = {
        "pool_id": pid,
        "name": body.get("name") or "New pool",
        "member_count": 0,
        "status": "ACTIVE",
        "members": [],
    }
    _d(ctx)["pools"].append(row)
    return deepcopy(row)


@router.get("/virtual-pools/{pool_id}")
async def pool_detail(pool_id: str, ctx: TenantContext = Depends(get_ctx)) -> dict:
    row = _find(_d(ctx)["pools"], "pool_id", pool_id)
    if not row:
        raise HTTPException(404, detail="Pool not found")
    out = deepcopy(row)
    out.setdefault(
        "members",
        [
            {"asset_id": "ast-3", "name": "Aer simulator pool"},
        ],
    )
    return out | {"source": "lab_demo"}


@router.post("/virtual-pools/{pool_id}/members")
async def pool_members(
    pool_id: str,
    body: dict = Body(default_factory=dict),
    ctx: TenantContext = Depends(get_ctx),
) -> dict:
    row = _find(_d(ctx)["pools"], "pool_id", pool_id)
    if not row:
        raise HTTPException(404, detail="Pool not found")
    row["member_count"] = int(row.get("member_count") or 0) + 1
    return _ok({"pool_id": pool_id, "asset_id": body.get("asset_id"), "member_count": row["member_count"]})


@router.get("/connectors")
async def connectors(ctx: TenantContext = Depends(get_ctx)) -> dict:
    return {
        "items": deepcopy(_d(ctx)["connectors"]),
        "legend": {
            "ready": "Accepts dispatch",
            "degraded": "Partial",
            "offline": "Unavailable",
        },
        "tenant_id": ctx.tenant_id,
        "source": "lab_demo",
        "generated_at": _now(),
    }


# ── Users / evidence / workloads / notifications ─────────────────────────────


@router.get("/users")
async def users_list(ctx: TenantContext = Depends(get_ctx)) -> dict:
    return items(_d(ctx)["users"]) | {"tenant_id": ctx.tenant_id, "generated_at": _now()}


@router.get("/users/roles/catalog")
async def roles_catalog(ctx: TenantContext = Depends(get_ctx)) -> dict:
    return {
        "roles": [
            {"id": "admin", "name": "Administrator", "description": "Full platform"},
            {"id": "reviewer", "name": "Reviewer", "description": "Approval stages"},
            {"id": "researcher", "name": "Researcher", "description": "Submit workloads"},
            {"id": "operator", "name": "Operator", "description": "Fleet ops"},
        ],
        "tenant_id": ctx.tenant_id,
    }


@router.get("/users/roles/permissions")
async def roles_permissions(ctx: TenantContext = Depends(get_ctx)) -> dict:
    return {
        "permissions": [
            "role:read",
            "permission:read",
            "user:read",
            "approval:decide",
            "dispatch:reconcile",
            "incident:manage",
        ],
        "tenant_id": ctx.tenant_id,
    }


@router.post("/users/{username}/role")
async def user_role(username: str, body: dict = Body(default_factory=dict), ctx: TenantContext = Depends(get_ctx)) -> dict:
    return _ok({"username": username, "role": body.get("role")})


@router.post("/users/roles")
async def users_roles_create(body: dict = Body(default_factory=dict), ctx: TenantContext = Depends(get_ctx)) -> dict:
    return _ok({"id": f"role-{uuid4().hex[:6]}", "name": body.get("name")})


@router.delete("/users/roles/{role_id}")
async def users_roles_delete(role_id: str, ctx: TenantContext = Depends(get_ctx)) -> dict:
    return _ok({"deleted": role_id})


@router.get("/evidence/snapshots")
async def evidence_list(ctx: TenantContext = Depends(get_ctx)) -> dict:
    return items(_d(ctx)["evidence"]) | {"tenant_id": ctx.tenant_id, "generated_at": _now()}


@router.post("/evidence/snapshots")
async def evidence_create(body: dict = Body(default_factory=dict), ctx: TenantContext = Depends(get_ctx)) -> dict:
    sid = f"evs-{uuid4().hex[:6]}"
    row = {
        "snapshot_id": sid,
        "label": body.get("label") or "Manual snapshot",
        "created_at": _now(),
        "kind": body.get("kind") or "manual",
    }
    _d(ctx)["evidence"].append(row)
    return deepcopy(row)


@router.post("/workload-submissions")
async def workload_create(body: dict = Body(default_factory=dict), ctx: TenantContext = Depends(get_ctx)) -> dict:
    sid = f"sub-{uuid4().hex[:6]}"
    return {
        "submission_id": sid,
        "title": body.get("title") or "Draft workload",
        "project_id": body.get("project_id"),
        "status": "draft",
        "source": "lab_demo",
    }


@router.post("/workload-submissions/{submission_id}/submit-for-review")
async def workload_submit(submission_id: str, body: dict = Body(default_factory=dict), ctx: TenantContext = Depends(get_ctx)) -> dict:
    wid = f"wl-demo-{uuid4().hex[:4]}"
    row = {
        "workload_id": wid,
        "title": body.get("title") or f"Submission {submission_id}",
        "governance_state": "submitted_for_review",
        "created_by": "admin",
        "project_id": body.get("project_id") or "prj-lab",
        "project_name": "Demo Lab",
        "shots": int(body.get("shots") or 1000),
        "backend_id": body.get("backend_id") or "sim-aer-local",
        "created_at": _now(),
        "updated_at": _now(),
    }
    _d(ctx)["approvals"].insert(0, row)
    d = _d(ctx)
    d["summary"]["counts"]["submitted_for_review"] = int(d["summary"]["counts"]["submitted_for_review"]) + 1
    d["summary"]["queue"] = int(d["summary"]["queue"]) + 1
    return deepcopy(row)


@router.get("/notifications")
async def notifications(ctx: TenantContext = Depends(get_ctx)) -> dict:
    return items(_d(ctx)["notifications"]) | {"tenant_id": ctx.tenant_id, "generated_at": _now()}


@router.post("/notifications/{notice_id}/read")
async def notification_read(notice_id: str, ctx: TenantContext = Depends(get_ctx)) -> dict:
    row = _find(_d(ctx)["notifications"], "id", notice_id)
    if row:
        row["read"] = True
    return _ok({"id": notice_id, "read": True})

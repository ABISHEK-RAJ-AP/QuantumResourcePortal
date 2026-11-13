"""Fixed lab demo catalogue — enough rows for a walkthrough without neighbour-app data."""

from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timedelta, timezone


def _ts(hours_ago: float = 0) -> str:
    return (
        datetime.now(timezone.utc) - timedelta(hours=hours_ago)
    ).isoformat().replace("+00:00", "Z")


def build_demo(tenant_id: str) -> dict:
    backends = [
        {
            "backend_id": "cdac-nv-01",
            "backend_name": "CDAC NV Lab-01",
            "operational_status": "ONLINE",
            "qpu_modality": "nv_center",
            "provider_id": "prov-cdac",
            "qubits": 8,
            "queue_depth": 3,
        },
        {
            "backend_id": "cdac-sc-02",
            "backend_name": "CDAC Supercond-02",
            "operational_status": "ONLINE",
            "qpu_modality": "superconducting",
            "provider_id": "prov-cdac",
            "qubits": 27,
            "queue_depth": 11,
        },
        {
            "backend_id": "cdac-ph-03",
            "backend_name": "CDAC Photonic-03",
            "operational_status": "MAINTENANCE",
            "qpu_modality": "photonic",
            "provider_id": "prov-partner",
            "qubits": 12,
            "queue_depth": 0,
        },
        {
            "backend_id": "sim-aer-local",
            "backend_name": "Local Aer simulator",
            "operational_status": "ONLINE",
            "qpu_modality": "simulator",
            "provider_id": "prov-sim",
            "qubits": 32,
            "queue_depth": 2,
        },
    ]

    approvals = [
        {
            "workload_id": "wl-demo-1001",
            "title": "VQE materials scan",
            "governance_state": "in_review",
            "created_by": "researcher",
            "project_id": "prj-lab",
            "project_name": "Demo Lab",
            "shots": 4000,
            "backend_id": "cdac-sc-02",
            "created_at": _ts(5),
            "updated_at": _ts(1),
        },
        {
            "workload_id": "wl-demo-1002",
            "title": "QAOA routing trial",
            "governance_state": "submitted_for_review",
            "created_by": "admin",
            "project_id": "prj-ops",
            "project_name": "Demo Ops",
            "shots": 2000,
            "backend_id": "cdac-nv-01",
            "created_at": _ts(12),
            "updated_at": _ts(3),
        },
        {
            "workload_id": "wl-demo-1003",
            "title": "Calibration sweep",
            "governance_state": "approved",
            "created_by": "researcher",
            "project_id": "prj-cal",
            "project_name": "Demo Calibration",
            "shots": 8000,
            "backend_id": "sim-aer-local",
            "created_at": _ts(28),
            "updated_at": _ts(6),
        },
        {
            "workload_id": "wl-demo-1004",
            "title": "Teaching circuit pack",
            "governance_state": "changes_requested",
            "created_by": "educator",
            "project_id": "prj-edu",
            "project_name": "Demo Education",
            "shots": 500,
            "backend_id": "sim-aer-local",
            "created_at": _ts(40),
            "updated_at": _ts(8),
        },
        {
            "workload_id": "wl-demo-1005",
            "title": "Noise benchmarking",
            "governance_state": "rejected",
            "created_by": "researcher",
            "project_id": "prj-lab",
            "project_name": "Demo Lab",
            "shots": 12000,
            "backend_id": "cdac-ph-03",
            "created_at": _ts(60),
            "updated_at": _ts(20),
        },
    ]

    attempts = [
        {
            "attempt_id": "att-9001",
            "workload_id": "wl-demo-1003",
            "dispatch_state": "dispatch_unresolved",
            "backend_id": "sim-aer-local",
            "created_at": _ts(4),
            "message": "Provider ack timeout — reconcile required",
        },
        {
            "attempt_id": "att-9002",
            "workload_id": "wl-demo-1001",
            "dispatch_state": "dispatch_authorized",
            "backend_id": "cdac-sc-02",
            "created_at": _ts(2),
            "message": "Authorized; awaiting job id",
        },
        {
            "attempt_id": "att-9003",
            "workload_id": "wl-demo-1003",
            "dispatch_state": "dispatch_confirmed",
            "backend_id": "sim-aer-local",
            "created_at": _ts(18),
            "message": "Confirmed",
        },
    ]

    activity = [
        {
            "event_id": "ev-1",
            "timestamp": _ts(1.5),
            "action": "APPROVAL_DECIDED",
            "outcome": "APPROVED",
            "actor": "admin",
            "target_id": "wl-demo-1003",
            "detail": "Stage 2 quota review passed",
        },
        {
            "event_id": "ev-2",
            "timestamp": _ts(6),
            "action": "APPROVAL_DECIDED",
            "outcome": "CHANGES_REQUESTED",
            "actor": "reviewer",
            "target_id": "wl-demo-1004",
            "detail": "Reduce shot budget",
        },
        {
            "event_id": "ev-3",
            "timestamp": _ts(20),
            "action": "APPROVAL_DECIDED",
            "outcome": "REJECTED",
            "actor": "admin",
            "target_id": "wl-demo-1005",
            "detail": "Backend offline for modality",
        },
        {
            "event_id": "ev-4",
            "timestamp": _ts(3),
            "action": "DISPATCH_ATTEMPT",
            "outcome": "UNRESOLVED",
            "actor": "system",
            "target_id": "att-9001",
            "detail": "Provider timeout",
        },
    ]

    projects = [
        {"project_id": "prj-lab", "code": "LAB", "name": "Demo Lab", "status": "ACTIVE", "member_count": 4},
        {"project_id": "prj-ops", "code": "OPS", "name": "Demo Ops", "status": "ACTIVE", "member_count": 3},
        {"project_id": "prj-cal", "code": "CAL", "name": "Demo Calibration", "status": "ACTIVE", "member_count": 2},
        {"project_id": "prj-edu", "code": "EDU", "name": "Demo Education", "status": "ACTIVE", "member_count": 5},
        {"project_id": "prj-rs", "code": "RSH", "name": "Demo Research", "status": "ACTIVE", "member_count": 6},
    ]

    assets = [
        {
            "asset_id": "ast-1",
            "name": "Dilution fridge A",
            "lifecycle": "active",
            "execution_class": "hardware",
            "provider_id": "prov-cdac",
        },
        {
            "asset_id": "ast-2",
            "name": "Control rack SC-02",
            "lifecycle": "active",
            "execution_class": "hardware",
            "provider_id": "prov-cdac",
        },
        {
            "asset_id": "ast-3",
            "name": "Aer simulator pool",
            "lifecycle": "active",
            "execution_class": "simulator",
            "provider_id": "prov-sim",
        },
        {
            "asset_id": "ast-4",
            "name": "Photonic bench (loan)",
            "lifecycle": "maintenance",
            "execution_class": "hardware",
            "provider_id": "prov-partner",
        },
    ]

    providers = [
        {"provider_id": "prov-cdac", "name": "C-DAC Quantum Lab", "status": "active", "stage": "live"},
        {"provider_id": "prov-partner", "name": "Partner Photonics", "status": "active", "stage": "onboarding"},
        {"provider_id": "prov-sim", "name": "Local simulators", "status": "active", "stage": "live"},
    ]

    pools = [
        {
            "pool_id": "pool-1",
            "name": "Shared sim pool",
            "member_count": 12,
            "status": "ACTIVE",
        },
        {
            "pool_id": "pool-2",
            "name": "NV priority pool",
            "member_count": 3,
            "status": "ACTIVE",
        },
    ]

    reservations = [
        {
            "reservation_id": "rsv-1",
            "project_id": "prj-lab",
            "backend_id": "cdac-nv-01",
            "status": "confirmed",
            "starts_at": _ts(-6),
            "ends_at": _ts(-2),
        },
        {
            "reservation_id": "rsv-2",
            "project_id": "prj-ops",
            "backend_id": "cdac-sc-02",
            "status": "hold",
            "starts_at": _ts(-24),
            "ends_at": _ts(-20),
        },
    ]

    jobs = [
        {
            "job_id": "job-501",
            "workload_id": "wl-demo-1003",
            "backend_id": "sim-aer-local",
            "status": "COMPLETED",
            "shots": 8000,
            "created_at": _ts(16),
        },
        {
            "job_id": "job-502",
            "workload_id": "wl-demo-1001",
            "backend_id": "cdac-sc-02",
            "status": "QUEUED",
            "shots": 4000,
            "created_at": _ts(2),
        },
        {
            "job_id": "job-503",
            "workload_id": "wl-demo-1002",
            "backend_id": "cdac-nv-01",
            "status": "RUNNING",
            "shots": 2000,
            "created_at": _ts(1),
        },
    ]

    queues = [
        {"backend_id": "cdac-sc-02", "backend_name": "CDAC Supercond-02", "pending": 11, "running": 1},
        {"backend_id": "cdac-nv-01", "backend_name": "CDAC NV Lab-01", "pending": 3, "running": 1},
        {"backend_id": "sim-aer-local", "backend_name": "Local Aer simulator", "pending": 2, "running": 0},
        {"backend_id": "cdac-ph-03", "backend_name": "CDAC Photonic-03", "pending": 0, "running": 0},
    ]

    alerts = [
        {
            "alert_id": "al-1",
            "severity": "WARNING",
            "status": "ACTIVE",
            "title": "Queue depth high on SC-02",
            "resource_id": "cdac-sc-02",
            "detected_at": _ts(0.5),
        },
        {
            "alert_id": "al-2",
            "severity": "CRITICAL",
            "status": "ACTIVE",
            "title": "Photonic bench offline",
            "resource_id": "cdac-ph-03",
            "detected_at": _ts(2),
        },
        {
            "alert_id": "al-3",
            "severity": "WARNING",
            "status": "ACKNOWLEDGED",
            "title": "Fridge A temperature drift",
            "resource_id": "ast-1",
            "detected_at": _ts(9),
        },
    ]

    incidents = [
        {
            "incident_id": "inc-1",
            "title": "Photonic modality unavailable",
            "backend_id": "cdac-ph-03",
            "severity": "CRITICAL",
            "status": "OPEN",
            "last_detected_at": _ts(2),
        },
        {
            "incident_id": "inc-2",
            "title": "Provider ack delays on Aer",
            "backend_id": "sim-aer-local",
            "severity": "WARNING",
            "status": "INVESTIGATING",
            "last_detected_at": _ts(4),
        },
    ]

    connectors = [
        {"connector_id": "conn-1", "name": "demo-noop", "status": "ready", "provider_id": "prov-sim"},
        {"connector_id": "conn-2", "name": "cdac-lab-bridge", "status": "ready", "provider_id": "prov-cdac"},
    ]

    users = [
        {"user_id": "u-admin", "username": "admin", "display_name": "Platform Administrator", "status": "ACTIVE"},
        {"user_id": "u-rs", "username": "researcher", "display_name": "Demo Researcher", "status": "ACTIVE"},
        {"user_id": "u-rev", "username": "reviewer", "display_name": "Demo Reviewer", "status": "ACTIVE"},
    ]

    evidence = [
        {
            "snapshot_id": "evs-1",
            "label": "Approval trail wl-demo-1003",
            "created_at": _ts(6),
            "kind": "approval",
        },
        {
            "snapshot_id": "evs-2",
            "label": "Dispatch attempt att-9001",
            "created_at": _ts(4),
            "kind": "dispatch",
        },
    ]

    notifications = [
        {
            "id": "n1",
            "title": "Review queue",
            "body": "2 requests waiting in Review Queue",
            "tone": "warning",
            "href": "/qrp/approvals",
            "at": _ts(0.2),
            "read": False,
        },
        {
            "id": "n2",
            "title": "Critical alert",
            "body": "Photonic bench offline",
            "tone": "critical",
            "href": "/qrp/alerts",
            "at": _ts(2),
            "read": False,
        },
        {
            "id": "n3",
            "title": "Reconcile",
            "body": "1 dispatch attempt unresolved",
            "tone": "warning",
            "href": "/qrp/reconciliation",
            "at": _ts(4),
            "read": True,
        },
    ]

    counts = {
        "submitted_for_review": 1,
        "in_review": 1,
        "changes_requested": 1,
        "rejected": 1,
        "approved": 1,
        "withdrawn": 0,
    }

    return {
        "tenant_id": tenant_id,
        "backends": backends,
        "approvals": approvals,
        "attempts": attempts,
        "activity": activity,
        "projects": projects,
        "assets": assets,
        "providers": providers,
        "pools": pools,
        "reservations": reservations,
        "jobs": jobs,
        "queues": queues,
        "alerts": alerts,
        "incidents": incidents,
        "connectors": connectors,
        "users": users,
        "evidence": evidence,
        "notifications": notifications,
        "summary": {
            "counts": counts,
            "queue": counts["submitted_for_review"] + counts["in_review"],
            "providers_active": 3,
            "providers_total": 3,
            "inventory_assets": len(assets),
            "meter_samples_24h": 128,
            "source": "lab_demo",
            "tenant_id": tenant_id,
            "generated_at": _ts(0),
        },
        "ledger": {
            "window": "today",
            "used_shots": 14500,
            "remaining_shots": 5500,
            "daily_shots_cap": 20000,
            "tenant_id": tenant_id,
            "source": "lab_demo",
            "generated_at": _ts(0),
        },
        "policy": {
            "policy_id": "default-two-stage",
            "schema_version": "1.0",
            "stages": [
                {"id": "technical", "name": "Technical review"},
                {"id": "quota", "name": "Quota & policy review"},
            ],
        },
    }


# One shared catalogue per process (lab demo).
_CACHE: dict | None = None


def demo(tenant_id: str) -> dict:
    global _CACHE
    if _CACHE is None or _CACHE.get("tenant_id") != tenant_id:
        _CACHE = build_demo(tenant_id)
    return _CACHE


def items(payload: list) -> dict:
    return {"items": deepcopy(payload)}

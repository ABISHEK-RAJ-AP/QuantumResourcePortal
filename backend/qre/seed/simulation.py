"""Development-only operational simulation — mutates persisted demo rows, never client state."""

from __future__ import annotations

import json
import random
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import text
from sqlalchemy.engine import Connection

from qre.services.svc17_audit.service import write_audit

SIM_KEY = "demo_simulation"


def _now() -> datetime:
    return datetime.now(UTC)


def _load_settings(conn: Connection, tenant_id: str) -> dict[str, Any]:
    raw = conn.execute(
        text("SELECT settings FROM tenant WHERE tenant_id = :t"),
        {"t": tenant_id},
    ).scalar()
    return raw if isinstance(raw, dict) else {}


def _save_sim(conn: Connection, tenant_id: str, patch: dict[str, Any]) -> dict[str, Any]:
    settings = _load_settings(conn, tenant_id)
    current = settings.get(SIM_KEY) if isinstance(settings.get(SIM_KEY), dict) else {}
    merged = {**current, **patch, "last_tick_at": _now().isoformat()}
    settings[SIM_KEY] = merged
    conn.execute(
        text(
            """
            UPDATE tenant SET settings = CAST(:s AS JSONB), updated_at = now()
            WHERE tenant_id = :t
            """
        ),
        {"t": tenant_id, "s": json.dumps(settings)},
    )
    return merged


def simulation_status(conn: Connection, tenant_id: str) -> dict[str, Any]:
    settings = _load_settings(conn, tenant_id)
    sim = settings.get(SIM_KEY) if isinstance(settings.get(SIM_KEY), dict) else {}
    demo_data = bool(settings.get("demo_data"))
    return {
        "available": True,
        "demo_data": demo_data,
        "enabled": bool(sim.get("enabled")),
        "paused": bool(sim.get("paused")),
        "scenario": int(sim.get("scenario") or 1),
        "tick_count": int(sim.get("tick_count") or 0),
        "last_tick_at": sim.get("last_tick_at"),
        "mode": "simulation" if sim.get("enabled") and not sim.get("paused") else "static",
    }


def start_simulation(
    conn: Connection,
    tenant_id: str,
    *,
    scenario: int = 1,
    actor_id: str | None,
) -> dict[str, Any]:
    state = _save_sim(
        conn,
        tenant_id,
        {"enabled": True, "paused": False, "scenario": max(1, min(scenario, 8)), "tick_count": 0},
    )
    write_audit(
        conn,
        tenant_id=tenant_id,
        action="DEMO_SIM_START",
        actor_id=actor_id,
        target_type="tenant",
        target_id=tenant_id,
        detail={"simulation": True, "scenario": state.get("scenario")},
        correlation_id="demo-simulation",
    )
    return simulation_status(conn, tenant_id)


def resume_simulation(conn: Connection, tenant_id: str, *, actor_id: str | None) -> dict[str, Any]:
    _save_sim(conn, tenant_id, {"enabled": True, "paused": False})
    write_audit(
        conn,
        tenant_id=tenant_id,
        action="DEMO_SIM_RESUME",
        actor_id=actor_id,
        target_type="tenant",
        target_id=tenant_id,
        detail={"simulation": True},
        correlation_id="demo-simulation",
    )
    return simulation_status(conn, tenant_id)


def pause_simulation(conn: Connection, tenant_id: str, *, actor_id: str | None) -> dict[str, Any]:
    _save_sim(conn, tenant_id, {"paused": True})
    write_audit(
        conn,
        tenant_id=tenant_id,
        action="DEMO_SIM_PAUSE",
        actor_id=actor_id,
        target_type="tenant",
        target_id=tenant_id,
        detail={"simulation": True},
        correlation_id="demo-simulation",
    )
    return simulation_status(conn, tenant_id)


def stop_simulation(conn: Connection, tenant_id: str, *, actor_id: str | None) -> dict[str, Any]:
    _save_sim(conn, tenant_id, {"enabled": False, "paused": True})
    write_audit(
        conn,
        tenant_id=tenant_id,
        action="DEMO_SIM_STOP",
        actor_id=actor_id,
        target_type="tenant",
        target_id=tenant_id,
        detail={"simulation": True},
        correlation_id="demo-simulation",
    )
    return simulation_status(conn, tenant_id)


def simulation_tick(conn: Connection, tenant_id: str, *, actor_id: str | None = None) -> dict[str, Any]:
    status = simulation_status(conn, tenant_id)
    if not status["enabled"] or status["paused"]:
        return status

    rng = random.Random(f"{tenant_id}:{status['tick_count']}")

    backends = conn.execute(
        text(
            """
            SELECT backend_id, queue_snapshot FROM catalogue_backend
            WHERE tenant_id = :t AND backend_id LIKE 'demo-%'
            """
        ),
        {"t": tenant_id},
    ).mappings().all()
    for row in backends[:4]:
        snap = row["queue_snapshot"] or {}
        if isinstance(snap, str):
            snap = json.loads(snap)
        pending = int((snap or {}).get("pending_jobs") or 0)
        delta = rng.randint(-2, 5)
        snap = {
            **(snap if isinstance(snap, dict) else {}),
            "pending_jobs": max(0, pending + delta),
            "queue_condition": "busy" if pending + delta > 40 else "idle",
            "trend": "up" if delta > 0 else "flat",
        }
        conn.execute(
            text(
                """
                UPDATE catalogue_backend
                SET queue_snapshot = CAST(:q AS JSONB), updated_at = now()
                WHERE tenant_id = :t AND backend_id = :b
                """
            ),
            {"t": tenant_id, "b": row["backend_id"], "q": json.dumps(snap)},
        )

    jobs = conn.execute(
        text(
            """
            SELECT job_id, status FROM provider_job
            WHERE tenant_id = :t AND job_id LIKE 'demo-job-%'
            ORDER BY submitted_at DESC
            LIMIT 40
            """
        ),
        {"t": tenant_id},
    ).mappings().all()
    if jobs:
        pick = rng.choice(jobs)
        new_status = pick["status"]
        if pick["status"] == "QUEUED":
            new_status = "RUNNING"
        elif pick["status"] == "RUNNING":
            new_status = "COMPLETED"
        conn.execute(
            text(
                """
                UPDATE provider_job
                SET status = :st, updated_at = now()
                WHERE tenant_id = :t AND job_id = :j
                """
            ),
            {"t": tenant_id, "j": pick["job_id"], "st": new_status},
        )

    conn.execute(
        text(
            """
            UPDATE ops_alert
            SET current_value = GREATEST(0, COALESCE(current_value, 0) + :d), updated_at = now()
            WHERE tenant_id = :t AND title LIKE '[DEMO]%'
            """
        ),
        {"t": tenant_id, "d": rng.randint(-3, 7)},
    )

    tick_count = int(status["tick_count"]) + 1
    state = _save_sim(conn, tenant_id, {"tick_count": tick_count})
    write_audit(
        conn,
        tenant_id=tenant_id,
        action="DEMO_SIM_TICK",
        actor_id=actor_id,
        target_type="tenant",
        target_id=tenant_id,
        detail={"simulation": True, "tick": tick_count},
        correlation_id="demo-simulation",
    )
    return simulation_status(conn, tenant_id)


def tick_all_enabled_tenants(conn: Connection) -> int:
    rows = conn.execute(
        text(
            """
            SELECT tenant_id FROM tenant
            WHERE (settings #>> '{demo_simulation,enabled}') = 'true'
              AND COALESCE(settings #>> '{demo_simulation,paused}', 'false') != 'true'
            """
        )
    ).scalars().all()
    n = 0
    for tid in rows:
        simulation_tick(conn, str(tid), actor_id=None)
        n += 1
    return n
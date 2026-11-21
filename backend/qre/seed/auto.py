"""Lab-only auto-seed on API startup (idempotent — skips when DEMO_SEED_VERSION already applied)."""

from __future__ import annotations

import logging

from sqlalchemy.engine import Connection

from qre.core.config import Settings
from qre.seed.seed_demo import SeedDemoError, seed_demo
from qre.seed.simulation import simulation_status, start_simulation

log = logging.getLogger("qre.seed.auto")


def run_auto_seed_demo(conn: Connection, settings: Settings) -> None:
    if not settings.is_lab or not settings.auto_seed_demo:
        return
    code = (settings.demo_tenant_code or "CDAC").strip()
    if not code:
        return
    try:
        result = seed_demo(conn, tenant_code=code)
        if result.created:
            log.info(
                "demo seed loaded",
                extra={"tenant": code, "counts": result.counts, "users": result.demo_users},
            )
        else:
            log.info("demo seed present", extra={"tenant": code, "counts": result.counts})
        sim = simulation_status(conn, result.tenant_id)
        if (result.created or bool(result.counts)) and not sim.get("enabled"):
            start_simulation(conn, result.tenant_id, scenario=1, actor_id=None)
            log.info("demo simulation started", extra={"tenant": code})
    except SeedDemoError as exc:
        log.warning("demo seed skipped", extra={"tenant": code, "reason": str(exc)})
    except Exception:
        log.exception("demo seed failed", extra={"tenant": code})

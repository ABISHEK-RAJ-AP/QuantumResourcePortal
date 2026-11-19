"""Lab-only auto-seed on API startup (idempotent — skips when DEMO_SEED_VERSION already applied)."""

from __future__ import annotations

import logging

from sqlalchemy.engine import Connection

from qre.core.config import Settings
from qre.seed.seed_demo import SeedDemoError, seed_demo

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
    except SeedDemoError as exc:
        log.warning("demo seed skipped", extra={"tenant": code, "reason": str(exc)})
    except Exception:
        log.exception("demo seed failed", extra={"tenant": code})
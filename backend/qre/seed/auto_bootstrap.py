"""Lab-only: ensure the demo tenant has a PLATFORM_ADMIN (admin / known password)."""

from __future__ import annotations

import logging

from sqlalchemy import text
from sqlalchemy.engine import Connection

from qre.core.config import Settings
from qre.services.svc02_identity.bootstrap import BootstrapError, bootstrap_admin

log = logging.getLogger("qre.seed.auto_bootstrap")

# Matches frontend AuthDemoPresets + docs/RBAC_DELIVERY.md lab copy.
LAB_ADMIN_USERNAME = "admin"
LAB_ADMIN_PASSWORD = "Admin-Strong-Pw-2026"
LAB_TENANT_NAME = "C-DAC Chennai"


def _tenant_has_platform_admin(conn: Connection, tenant_code: str) -> bool:
    row = conn.execute(
        text(
            """
            SELECT 1
            FROM role_assignment ra
            JOIN app_user u ON u.user_id = ra.principal_id
            JOIN tenant t ON t.tenant_id = u.tenant_id
            JOIN role r ON r.role_id = ra.role_id
            WHERE t.code = :code
              AND r.code = 'PLATFORM_ADMIN'
              AND u.status = 'ACTIVE'
            LIMIT 1
            """
        ),
        {"code": tenant_code},
    ).scalar()
    return row is not None


def run_auto_bootstrap_lab(conn: Connection, settings: Settings) -> None:
    if not settings.is_lab:
        return
    code = (settings.demo_tenant_code or "CDAC").strip()
    if not code:
        return
    if _tenant_has_platform_admin(conn, code):
        return
    try:
        result = bootstrap_admin(
            conn,
            tenant_code=code,
            tenant_name=LAB_TENANT_NAME,
            admin_username=LAB_ADMIN_USERNAME,
            password=LAB_ADMIN_PASSWORD,
            display_name="Platform Admin",
        )
        log.info(
            "lab auto-bootstrap complete",
            extra={
                "tenant_code": result.tenant_code,
                "admin_username": result.admin_username,
                "created_tenant": result.created_tenant,
            },
        )
    except BootstrapError as exc:
        log.warning("lab auto-bootstrap skipped", extra={"tenant": code, "reason": str(exc)})
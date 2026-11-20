"""Lab-only: ensure the demo tenant has a PLATFORM_ADMIN (admin / known password)."""

from __future__ import annotations

import logging

from sqlalchemy import text
from sqlalchemy.engine import Connection

from qre.core.config import Settings
from qre.core.security import hash_password
from qre.services.svc02_identity.bootstrap import BootstrapError, bootstrap_admin

log = logging.getLogger("qre.seed.auto_bootstrap")

# Matches frontend AuthDemoPresets + docs/RBAC_DELIVERY.md lab copy.
LAB_ADMIN_USERNAME = "admin"
LAB_ADMIN_PASSWORD = "Admin-Strong-Pw-2026"
LAB_DEMO_OPERATOR = "demo_operator"
LAB_DEMO_OPERATOR_PASSWORD = "Demo-Strong-Pw-2026"
LAB_TENANT_NAME = "C-DAC Chennai"


def _tenant_has_platform_admin(conn: Connection, tenant_code: str) -> bool:
    row = conn.execute(
        text(
            """
            SELECT 1
            FROM role_assignment ra
            JOIN app_user u ON u.user_id = ra.principal_id
            JOIN tenant t ON t.tenant_id = ra.tenant_id
            WHERE t.code = :code
              AND ra.role = 'PLATFORM_ADMIN'
              AND ra.scope_type = 'TENANT'
              AND ra.revoked_at IS NULL
              AND u.status = 'ACTIVE'
            LIMIT 1
            """
        ),
        {"code": tenant_code},
    ).scalar()
    return row is not None


def _sync_lab_admin_password(conn: Connection, *, tenant_code: str, username: str, password: str) -> bool:
    """Reset known lab demo password and clear lockout (idempotent)."""
    user_id = conn.execute(
        text(
            """
            SELECT u.user_id
            FROM app_user u
            JOIN tenant t ON t.tenant_id = u.home_tenant_id
            WHERE u.username = :u AND t.code = :c AND u.status = 'ACTIVE'
            LIMIT 1
            """
        ),
        {"u": username, "c": tenant_code},
    ).scalar()
    if not user_id:
        return False
    conn.execute(
        text(
            """
            UPDATE user_credential
            SET password_hash = :h,
                failed_count = 0,
                locked_until = NULL
            WHERE user_id = :uid
            """
        ),
        {"uid": user_id, "h": hash_password(password)},
    )
    return True


def run_auto_bootstrap_lab(conn: Connection, settings: Settings) -> None:
    if not settings.is_lab:
        return
    code = (settings.demo_tenant_code or "CDAC").strip()
    if not code:
        return
    if _sync_lab_admin_password(
        conn, tenant_code=code, username=LAB_ADMIN_USERNAME, password=LAB_ADMIN_PASSWORD
    ):
        log.info(
            "lab admin credentials synced",
            extra={"tenant_code": code, "admin_username": LAB_ADMIN_USERNAME},
        )

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


def sync_lab_demo_passwords(conn: Connection, settings: Settings) -> None:
    """After demo seed — reset known lab passwords and clear lockouts."""
    if not settings.is_lab:
        return
    code = (settings.demo_tenant_code or "CDAC").strip()
    if not code:
        return
    for username, password in (
        (LAB_ADMIN_USERNAME, LAB_ADMIN_PASSWORD),
        (LAB_DEMO_OPERATOR, LAB_DEMO_OPERATOR_PASSWORD),
    ):
        if _sync_lab_admin_password(conn, tenant_code=code, username=username, password=password):
            log.info("lab credentials synced", extra={"tenant_code": code, "username": username})
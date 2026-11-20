"""Lab-only: ensure the demo tenant has a PLATFORM_ADMIN (admin / unified lab password)."""

from __future__ import annotations

import logging

from sqlalchemy import text
from sqlalchemy.engine import Connection

from qre.core.config import Settings
from qre.core.security import hash_password
from qre.seed.lab_credentials import (
    LAB_ADMIN_USERNAME,
    LAB_PASSWORD_MIN_LEN,
    LAB_TENANT_NAME,
    LAB_UNIFIED_PASSWORD,
)
from qre.services.svc02_identity.bootstrap import BootstrapError, bootstrap_admin

log = logging.getLogger("qre.seed.auto_bootstrap")


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


def _sync_user_password(conn: Connection, *, tenant_code: str, username: str, password: str) -> bool:
    """Reset lab password and clear lockout (idempotent)."""
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
    if _sync_user_password(
        conn, tenant_code=code, username=LAB_ADMIN_USERNAME, password=LAB_UNIFIED_PASSWORD
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
            password=LAB_UNIFIED_PASSWORD,
            display_name="Platform Admin",
            password_min_len=LAB_PASSWORD_MIN_LEN,
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
    """Reset every active user on the demo tenant to the unified lab password."""
    if not settings.is_lab:
        return
    code = (settings.demo_tenant_code or "CDAC").strip()
    if not code:
        return
    rows = conn.execute(
        text(
            """
            SELECT u.username
            FROM app_user u
            JOIN tenant t ON t.tenant_id = u.home_tenant_id
            WHERE t.code = :c AND u.status = 'ACTIVE'
            ORDER BY u.username
            """
        ),
        {"c": code},
    ).fetchall()
    synced = 0
    for (username,) in rows:
        if _sync_user_password(
            conn, tenant_code=code, username=str(username), password=LAB_UNIFIED_PASSWORD
        ):
            synced += 1
    if synced:
        log.info(
            "lab credentials synced",
            extra={"tenant_code": code, "user_count": synced, "password": "unified"},
        )
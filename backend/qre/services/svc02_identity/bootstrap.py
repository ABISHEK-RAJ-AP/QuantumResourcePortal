"""Installer bootstrap: create a tenant and its first PLATFORM_ADMIN (LLD §4.3 precondition).

Run once per tenant by ``python -m qre bootstrap``. Refuses to create a second admin for a tenant
that already has an active one (so re-running is safe and cannot be used to add admins silently).
The first admin is self-granted; the grant is audited. Written for a synchronous Connection so the
CLI and tests share one code path.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from sqlalchemy import text
from sqlalchemy.engine import Connection

from qre.core.ids import new_ulid
from qre.core.security import hash_password
from qre.services.svc17_audit.service import write_audit

_CODE_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{1,31}$")
_USERNAME_RE = re.compile(r"^[a-z0-9][a-z0-9._-]{2,127}$")
ADMIN_ROLE = "PLATFORM_ADMIN"


class BootstrapError(Exception):
    """Raised for invalid input or when the tenant already has an admin."""


@dataclass(frozen=True)
class BootstrapResult:
    tenant_id: str
    user_id: str
    tenant_code: str
    admin_username: str
    created_tenant: bool


def bootstrap_admin(
    conn: Connection,
    *,
    tenant_code: str,
    tenant_name: str,
    admin_username: str,
    password: str,
    email: str | None = None,
) -> BootstrapResult:
    code = tenant_code.strip()
    username = admin_username.strip().lower()
    if not _CODE_RE.match(code):
        raise BootstrapError("tenant code must be 2–32 chars of letters, digits, '-' or '_'")
    if not _USERNAME_RE.match(username):
        raise BootstrapError(
            "admin username must be 3–128 chars (lower-case letters, digits, . _ -)"
        )
    if len(password) < 12:
        raise BootstrapError("admin password must be at least 12 characters (PD-12)")

    # Resolve the seeded system role; the catalogue must be loaded first (migration 0005).
    role_id = conn.execute(
        text("SELECT role_id FROM role WHERE code = :c AND is_system"), {"c": ADMIN_ROLE}
    ).scalar()
    if not role_id:
        raise BootstrapError(
            f"system role {ADMIN_ROLE} is not seeded — run 'alembic upgrade head' first"
        )

    # Tenant: create if absent.
    tenant_id = conn.execute(
        text("SELECT tenant_id FROM tenant WHERE code = :c"), {"c": code}
    ).scalar()
    created_tenant = False
    if not tenant_id:
        tenant_id = new_ulid()
        conn.execute(
            text("INSERT INTO tenant (tenant_id, code, name) VALUES (:id, :code, :name)"),
            {"id": tenant_id, "code": code, "name": tenant_name.strip() or code},
        )
        created_tenant = True

    # Refuse a second admin for a tenant that already has an active PLATFORM_ADMIN.
    existing_admin = conn.execute(
        text(
            """
            SELECT 1 FROM role_assignment ra JOIN app_user u ON u.user_id = ra.principal_id
            WHERE ra.tenant_id = :t AND ra.role = :role AND ra.scope_type = 'TENANT'
              AND ra.revoked_at IS NULL AND u.status = 'ACTIVE'
            LIMIT 1
            """
        ),
        {"t": tenant_id, "role": ADMIN_ROLE},
    ).scalar()
    if existing_admin:
        raise BootstrapError(
            f"tenant '{code}' already has an active {ADMIN_ROLE}; refusing to create another"
        )

    # Refuse a duplicate username.
    if conn.execute(text("SELECT 1 FROM app_user WHERE username = :u"), {"u": username}).scalar():
        raise BootstrapError(f"username '{username}' already exists")

    user_id = new_ulid()
    conn.execute(
        text(
            """
            INSERT INTO app_user (user_id, home_tenant_id, username, email, display_name,
                                  status, auth_mode, created_by)
            VALUES (:id, :tid, :u, :email, :dn, 'ACTIVE', 'LOCAL', :id)
            """
        ),
        {"id": user_id, "tid": tenant_id, "u": username,
         "email": email or f"{username}@{code}.local", "dn": "Platform Administrator"},
    )
    conn.execute(
        text("INSERT INTO user_credential (user_id, password_hash) VALUES (:id, :h)"),
        {"id": user_id, "h": hash_password(password)},
    )
    conn.execute(
        text(
            """
            INSERT INTO role_assignment (membership_id, tenant_id, principal_id, principal_type,
                                         role, role_id, scope_type, scope_id, granted_by)
            VALUES (:mid, :tid, :pid, 'USER', :role, :rid, 'TENANT', NULL, :pid)
            """
        ),
        {"mid": new_ulid(), "tid": tenant_id, "pid": user_id, "role": ADMIN_ROLE, "rid": role_id},
    )
    write_audit(
        conn,
        tenant_id=tenant_id,
        action="BOOTSTRAP_ADMIN",
        actor_id=user_id,
        target_type="app_user",
        target_id=user_id,
        detail={"username": username, "role": ADMIN_ROLE, "tenant_code": code},
        correlation_id="bootstrap",
    )
    return BootstrapResult(tenant_id, user_id, code, username, created_tenant)

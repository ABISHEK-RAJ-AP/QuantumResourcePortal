"""Role / permission / user / membership administration (RBAC-5, API-IAM-07 and the /admin surface).

Each mutation runs in the request transaction, writes an audit row, and bumps tenant.authz_version
when it changes what a role grants. Anti-escalation and last-admin rules come from policies.py; the
database triggers (migration 0003) are the backstop. Custom roles are tenant-scoped; the nine
system roles are immutable here (the DB rejects changes, surfaced as 409).
"""

from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from qre.core import authz
from qre.core.context import TenantContext
from qre.core.errors import (
    Forbidden,
    InvalidStateTransition,
    QreError,
    ResourceNotFound,
    ValidationFailed,
)
from qre.core.ids import new_ulid
from qre.services.svc02_identity import policies
from qre.services.svc17_audit.service import write_audit_async


class RevisionConflict(QreError):
    code = "REVISION_CONFLICT"


class DuplicateRole(QreError):
    code = "INVALID_STATE_TRANSITION"


async def _audit(session, ctx: TenantContext, action, **kw) -> None:
    await write_audit_async(
        session, tenant_id=ctx.tenant_id, action=action, actor_id=ctx.principal_id,
        correlation_id=ctx.correlation_id, **kw,
    )


async def _bump_authz_version(session: AsyncSession, tenant_id: str) -> None:
    await session.execute(
        text("UPDATE tenant SET authz_version = authz_version + 1 WHERE tenant_id = :t"),
        {"t": tenant_id},
    )


# --------------------------------------------------------------------------- roles


async def list_roles(session: AsyncSession, ctx: TenantContext) -> list[dict]:
    rows = (
        await session.execute(
            text(
                """
                SELECT r.role_id, r.code, r.name, r.description, r.assignable_scope, r.is_system,
                       r.status, r.row_version,
                       (SELECT count(*) FROM role_permission rp WHERE rp.role_id = r.role_id)
                           AS permission_count,
                       (SELECT count(*) FROM role_assignment ra
                        WHERE ra.role_id = r.role_id AND ra.revoked_at IS NULL) AS user_count
                FROM role r
                WHERE r.deleted_at IS NULL AND (r.is_system OR r.tenant_id = :t)
                ORDER BY r.is_system DESC, r.code
                """
            ),
            {"t": ctx.tenant_id},
        )
    ).mappings().all()
    return [dict(r) for r in rows]


async def _role_facts(session: AsyncSession, ctx: TenantContext, role_id: str) -> dict:
    row = (
        await session.execute(
            text(
                """
                SELECT role_id, code, name, description, assignable_scope, is_system, status,
                       row_version
                FROM role
                WHERE role_id = :r AND deleted_at IS NULL AND (is_system OR tenant_id = :t)
                """
            ),
            {"r": role_id, "t": ctx.tenant_id},
        )
    ).mappings().first()
    if not row:
        raise ResourceNotFound()
    return dict(row)


async def get_role(session: AsyncSession, ctx: TenantContext, role_id: str) -> dict:
    role = await _role_facts(session, ctx, role_id)
    perms = (
        await session.execute(
            text(
                """
                SELECT p.code FROM role_permission rp JOIN permission p
                       ON p.permission_id = rp.permission_id
                WHERE rp.role_id = :r ORDER BY p.code
                """
            ),
            {"r": role_id},
        )
    ).scalars().all()
    role["permissions"] = list(perms)
    return role


async def _resolve_permission_ids(session: AsyncSession, codes: list[str]) -> list[tuple[str, str]]:
    cat = authz.catalogue()
    unknown = [c for c in codes if c not in cat.codes]
    if unknown:
        raise ValidationFailed(detail=f"Unknown permission codes: {sorted(set(unknown))}")
    rows = (
        await session.execute(
            text("SELECT permission_id, code FROM permission WHERE code = ANY(:codes)"),
            {"codes": list(set(codes))},
        )
    ).all()
    return [(r.permission_id, r.code) for r in rows]


def _contains_privileged(codes: list[str]) -> bool:
    return bool(set(codes) & authz.catalogue().privileged)


async def create_role(
    session: AsyncSession, ctx: TenantContext, *, code: str, name: str, description: str,
    assignable_scope: str, permission_codes: list[str],
) -> dict:
    if assignable_scope not in ("TENANT", "PROJECT", "PROVIDER"):
        raise ValidationFailed(detail="assignable_scope must be TENANT, PROJECT or PROVIDER")
    reason = policies.can_grant_permission_set(
        policies.actor_admin_scope(ctx), contains_privileged=_contains_privileged(permission_codes)
    )
    if reason:
        raise Forbidden(detail=reason)
    perm_ids = await _resolve_permission_ids(session, permission_codes)
    role_id = new_ulid()
    try:
        await session.execute(
            text(
                """
                INSERT INTO role (role_id, tenant_id, code, name, description, assignable_scope,
                                  is_system, status, created_by, updated_by)
                VALUES (:id, :t, :code, :name, :desc, :scope, false, 'ACTIVE', :by, :by)
                """
            ),
            {"id": role_id, "t": ctx.tenant_id, "code": code, "name": name, "desc": description,
             "scope": assignable_scope, "by": ctx.principal_id},
        )
    except Exception as exc:  # unique or no-shadow violation
        raise DuplicateRole(detail=f"role code {code} already exists or is reserved") from exc
    for pid, _code in perm_ids:
        await session.execute(
            text("INSERT INTO role_permission (role_id, permission_id, granted_by) "
                 "VALUES (:r, :p, :by)"),
            {"r": role_id, "p": pid, "by": ctx.principal_id},
        )
    await _audit(session, ctx, "ROLE_CREATED", target_type="role", target_id=role_id,
                 detail={"code": code, "scope": assignable_scope, "permissions": permission_codes})
    return await get_role(session, ctx, role_id)


async def update_role(
    session: AsyncSession, ctx: TenantContext, role_id: str, *, name: str | None,
    description: str | None, if_match: int | None,
) -> dict:
    role = await _role_facts(session, ctx, role_id)
    if role["is_system"]:
        raise InvalidStateTransition(detail="system roles cannot be edited")
    if if_match is not None and if_match != role["row_version"]:
        raise RevisionConflict()
    await session.execute(
        text(
            """
            UPDATE role SET name = COALESCE(:name, name),
                            description = COALESCE(:desc, description),
                            row_version = row_version + 1, updated_at = now(), updated_by = :by
            WHERE role_id = :r
            """
        ),
        {"name": name, "desc": description, "by": ctx.principal_id, "r": role_id},
    )
    await _audit(session, ctx, "ROLE_UPDATED", target_type="role", target_id=role_id,
                 detail={"name": name, "description": description})
    return await get_role(session, ctx, role_id)


async def set_role_status(
    session: AsyncSession, ctx: TenantContext, role_id: str, *, active: bool
) -> dict:
    role = await _role_facts(session, ctx, role_id)
    if role["is_system"]:
        raise InvalidStateTransition(detail="system roles cannot be deactivated")
    await session.execute(
        text("UPDATE role SET status = :s, row_version = row_version + 1, updated_by = :by "
             "WHERE role_id = :r"),
        {"s": "ACTIVE" if active else "INACTIVE", "by": ctx.principal_id, "r": role_id},
    )
    await _bump_authz_version(session, ctx.tenant_id)  # changes effective permissions
    await _audit(session, ctx, "ROLE_ACTIVATED" if active else "ROLE_DEACTIVATED",
                 target_type="role", target_id=role_id)
    return await get_role(session, ctx, role_id)


async def set_role_permissions(
    session: AsyncSession, ctx: TenantContext, role_id: str, *, permission_codes: list[str],
    if_match: int | None,
) -> dict:
    role = await _role_facts(session, ctx, role_id)
    if role["is_system"]:
        raise InvalidStateTransition(detail="system role permissions are immutable")
    if if_match is not None and if_match != role["row_version"]:
        raise RevisionConflict()
    reason = policies.can_grant_permission_set(
        policies.actor_admin_scope(ctx), contains_privileged=_contains_privileged(permission_codes)
    )
    if reason:
        raise Forbidden(detail=reason)
    perm_ids = await _resolve_permission_ids(session, permission_codes)
    before = (
        await session.execute(
            text("SELECT p.code FROM role_permission rp JOIN permission p "
                 "ON p.permission_id = rp.permission_id WHERE rp.role_id = :r"),
            {"r": role_id},
        )
    ).scalars().all()
    await session.execute(text("DELETE FROM role_permission WHERE role_id = :r"), {"r": role_id})
    for pid, _c in perm_ids:
        await session.execute(
            text("INSERT INTO role_permission (role_id, permission_id, granted_by) "
                 "VALUES (:r, :p, :by)"),
            {"r": role_id, "p": pid, "by": ctx.principal_id},
        )
    await session.execute(
        text("UPDATE role SET row_version = row_version + 1, updated_by = :by WHERE role_id = :r"),
        {"by": ctx.principal_id, "r": role_id},
    )
    await _bump_authz_version(session, ctx.tenant_id)
    await _audit(session, ctx, "PERMISSION_ASSIGNED", target_type="role", target_id=role_id,
                 detail={"before": sorted(before), "after": sorted(set(permission_codes))})
    return await get_role(session, ctx, role_id)


async def delete_role(session: AsyncSession, ctx: TenantContext, role_id: str) -> None:
    role = await _role_facts(session, ctx, role_id)
    if role["is_system"]:
        raise InvalidStateTransition(detail="system roles cannot be deleted")
    assigned = (
        await session.execute(
            text("SELECT count(*) FROM role_assignment WHERE role_id = :r AND revoked_at IS NULL"),
            {"r": role_id},
        )
    ).scalar()
    if assigned:
        raise InvalidStateTransition(detail="role is assigned to users; revoke assignments first")
    await session.execute(
        text("UPDATE role SET deleted_at = now(), updated_by = :by WHERE role_id = :r"),
        {"by": ctx.principal_id, "r": role_id},
    )
    await _audit(session, ctx, "ROLE_DELETED", target_type="role", target_id=role_id,
                 detail={"code": role["code"]})


async def list_role_users(session: AsyncSession, ctx: TenantContext, role_id: str) -> list[dict]:
    await _role_facts(session, ctx, role_id)
    rows = (
        await session.execute(
            text(
                """
                SELECT u.user_id, u.username, u.display_name, ra.scope_type, ra.scope_id,
                       ra.granted_at
                FROM role_assignment ra JOIN app_user u ON u.user_id = ra.principal_id
                WHERE ra.role_id = :r AND ra.tenant_id = :t AND ra.revoked_at IS NULL
                ORDER BY u.username
                """
            ),
            {"r": role_id, "t": ctx.tenant_id},
        )
    ).mappings().all()
    return [dict(r) for r in rows]


# --------------------------------------------------------------------------- permissions


async def list_permissions(session: AsyncSession, ctx: TenantContext) -> list[dict]:
    rows = (
        await session.execute(
            text(
                """
                SELECT p.code, p.module, p.action, p.name, p.is_privileged,
                       (SELECT array_agg(r.code ORDER BY r.code) FROM role_permission rp
                        JOIN role r ON r.role_id = rp.role_id
                        WHERE rp.permission_id = p.permission_id AND r.deleted_at IS NULL
                              AND (r.is_system OR r.tenant_id = :t)) AS roles
                FROM permission p ORDER BY p.module, p.code
                """
            ),
            {"t": ctx.tenant_id},
        )
    ).mappings().all()
    return [dict(r) for r in rows]


# --------------------------------------------------------------------------- users


async def list_users(session: AsyncSession, ctx: TenantContext) -> list[dict]:
    rows = (
        await session.execute(
            text(
                """
                SELECT user_id, username, display_name, email, status, mfa_enrolled, created_at
                FROM app_user WHERE home_tenant_id = :t ORDER BY username
                """
            ),
            {"t": ctx.tenant_id},
        )
    ).mappings().all()
    return [dict(r) for r in rows]


async def create_user(
    session: AsyncSession, ctx: TenantContext, *, username: str, display_name: str,
    email: str | None, password: str | None,
) -> dict:
    """Create a tenant user (R-05). Starts with no roles; an admin grants them separately."""
    from qre.core.security import hash_password

    uname = username.strip().lower()
    if (
        await session.execute(text("SELECT 1 FROM app_user WHERE username = :u"), {"u": uname})
    ).scalar():
        raise InvalidStateTransition(detail="username already exists")
    user_id = new_ulid()
    await session.execute(
        text(
            """
            INSERT INTO app_user (user_id, home_tenant_id, username, email, display_name,
                                  status, auth_mode, created_by)
            VALUES (:id, :t, :u, :email, :dn, 'ACTIVE', 'LOCAL', :by)
            """
        ),
        {"id": user_id, "t": ctx.tenant_id, "u": uname, "email": email,
         "dn": display_name or uname, "by": ctx.principal_id},
    )
    if password:
        await session.execute(
            text("INSERT INTO user_credential (user_id, password_hash) VALUES (:u, :h)"),
            {"u": user_id, "h": hash_password(password)},
        )
    await _audit(session, ctx, "USER_CREATED", target_type="app_user", target_id=user_id,
                 detail={"username": uname})
    return {"user_id": user_id, "username": uname, "display_name": display_name or uname,
            "email": email, "status": "ACTIVE"}


async def set_user_status(
    session: AsyncSession, ctx: TenantContext, user_id: str, *, active: bool
) -> dict:
    """Activate/deactivate a user. Deactivating revokes sessions; guarded for the last admin."""
    row = (
        await session.execute(
            text("SELECT username, status FROM app_user "
                 "WHERE user_id = :u AND home_tenant_id = :t"),
            {"u": user_id, "t": ctx.tenant_id},
        )
    ).mappings().first()
    if not row:
        raise ResourceNotFound()

    if not active:
        # Deactivating a platform admin is subject to the last-admin guard (S-7).
        await session.execute(
            text("SELECT pg_advisory_xact_lock(hashtext('qre_authz:' || :t))"), {"t": ctx.tenant_id}
        )
        is_admin = (
            await session.execute(
                text(
                    "SELECT 1 FROM role_assignment WHERE principal_id = :u AND tenant_id = :t "
                    "AND role = :role AND scope_type = 'TENANT' AND revoked_at IS NULL"
                ),
                {"u": user_id, "t": ctx.tenant_id, "role": policies.PLATFORM_ADMIN},
            )
        ).scalar()
        if is_admin:
            n = await _count_active_platform_admins(session, ctx.tenant_id)
            guard = policies.last_admin_guard(n, removing_an_admin=True)
            if guard:
                raise InvalidStateTransition(detail=guard)

    await session.execute(
        text(
            "UPDATE app_user SET status = :s, "
            "deactivated_at = CASE WHEN :active THEN NULL ELSE now() END, updated_by = :by "
            "WHERE user_id = :u"
        ),
        {"s": "ACTIVE" if active else "DISABLED", "active": active, "by": ctx.principal_id,
         "u": user_id},
    )
    if not active:
        await session.execute(
            text("UPDATE session SET revoked_at = now() WHERE principal_id = :u "
                 "AND revoked_at IS NULL"),
            {"u": user_id},
        )
    await _audit(session, ctx, "USER_ACTIVATED" if active else "USER_DEACTIVATED",
                 target_type="app_user", target_id=user_id, detail={"username": row["username"]})
    return {"user_id": user_id, "username": row["username"],
            "status": "ACTIVE" if active else "DISABLED"}


async def get_user_effective_permissions(
    session: AsyncSession, ctx: TenantContext, user_id: str
) -> dict:
    exists = (
        await session.execute(
            text("SELECT username FROM app_user WHERE user_id = :u AND home_tenant_id = :t"),
            {"u": user_id, "t": ctx.tenant_id},
        )
    ).scalar()
    if not exists:
        raise ResourceNotFound()
    from qre.services.svc02_identity.repository import grants_for_principal

    grants = await grants_for_principal(session, ctx.tenant_id, user_id)
    return {
        "user_id": user_id,
        "username": exists,
        "permissions": sorted({g.permission for g in grants}),
        "grants": sorted(
            ({"permission": g.permission, "scope_type": g.scope_type, "scope_id": g.scope_id}
             for g in grants),
            key=lambda g: (g["permission"], g["scope_type"]),
        ),
    }


# --------------------------------------------------------------------------- memberships


async def list_memberships(session: AsyncSession, ctx: TenantContext, *, principal_id: str | None):
    rows = (
        await session.execute(
            text(
                """
                SELECT ra.membership_id, ra.principal_id, u.username, ra.role, ra.scope_type,
                       ra.scope_id, ra.granted_by, ra.granted_at
                FROM role_assignment ra JOIN app_user u ON u.user_id = ra.principal_id
                WHERE ra.tenant_id = :t AND ra.revoked_at IS NULL
                  AND (CAST(:pid AS VARCHAR) IS NULL OR ra.principal_id = :pid)
                ORDER BY u.username, ra.role
                """
            ),
            {"t": ctx.tenant_id, "pid": principal_id},
        )
    ).mappings().all()
    return [dict(r) for r in rows]


async def grant_membership(
    session: AsyncSession, ctx: TenantContext, *, principal_id: str, role_code: str,
    scope_type: str, scope_id: str | None,
) -> dict:
    # Resolve the role (system or this tenant's custom) and its facts.
    role = (
        await session.execute(
            text(
                """
                SELECT role_id, code, assignable_scope, is_system FROM role
                WHERE code = :c AND status = 'ACTIVE' AND deleted_at IS NULL
                  AND (is_system OR tenant_id = :t)
                """
            ),
            {"c": role_code, "t": ctx.tenant_id},
        )
    ).mappings().first()
    if not role:
        raise ValidationFailed(detail=f"unknown or inactive role {role_code}")
    if not (
        await session.execute(
            text("SELECT 1 FROM app_user WHERE user_id = :u AND home_tenant_id = :t"),
            {"u": principal_id, "t": ctx.tenant_id},
        )
    ).scalar():
        raise ResourceNotFound()

    role_is_privileged = await _role_grants_privileged(session, role["role_id"])
    reason = policies.can_grant_role(
        policies.actor_admin_scope(ctx), role_code=role_code,
        role_scope=role["assignable_scope"], is_system=role["is_system"],
        role_is_privileged=role_is_privileged, target_scope_type=scope_type,
        target_scope_id=scope_id,
    )
    if reason:
        raise Forbidden(detail=reason)

    membership_id = new_ulid()
    try:
        await session.execute(
            text(
                """
                INSERT INTO role_assignment (membership_id, tenant_id, principal_id, principal_type,
                                             role, role_id, scope_type, scope_id, granted_by)
                VALUES (:m, :t, :p, 'USER', :role, :rid, :st, :sid, :by)
                """
            ),
            {"m": membership_id, "t": ctx.tenant_id, "p": principal_id, "role": role_code,
             "rid": role["role_id"], "st": scope_type, "sid": scope_id, "by": ctx.principal_id},
        )
    except Exception as exc:  # duplicate active assignment, scope mismatch, or scope not in tenant
        raise InvalidStateTransition(
            detail="assignment already exists or violates scope rules"
        ) from exc
    await _bump_membership_version(session, principal_id)
    await _audit(session, ctx, "ROLE_GRANTED", target_type="app_user", target_id=principal_id,
                 detail={"role": role_code, "scope_type": scope_type, "scope_id": scope_id})
    return {"membership_id": membership_id, "principal_id": principal_id, "role": role_code,
            "scope_type": scope_type, "scope_id": scope_id}


async def revoke_membership(
    session: AsyncSession, ctx: TenantContext, membership_id: str, *, reason: str | None,
) -> None:
    row = (
        await session.execute(
            text(
                "SELECT principal_id, role, scope_type, scope_id FROM role_assignment "
                "WHERE membership_id = :m AND tenant_id = :t AND revoked_at IS NULL"
            ),
            {"m": membership_id, "t": ctx.tenant_id},
        )
    ).mappings().first()
    if not row:
        raise ResourceNotFound()

    deny = policies.can_revoke_assignment(
        policies.actor_admin_scope(ctx), assignment_role=row["role"],
        assignment_scope_type=row["scope_type"], assignment_scope_id=row["scope_id"],
    )
    if deny:
        raise Forbidden(detail=deny)

    if row["role"] == policies.PLATFORM_ADMIN and row["scope_type"] == "TENANT":
        # Serialise admin changes for the tenant, then count remaining active admins (S-7).
        await session.execute(
            text("SELECT pg_advisory_xact_lock(hashtext('qre_authz:' || :t))"), {"t": ctx.tenant_id}
        )
        n = await _count_active_platform_admins(session, ctx.tenant_id)
        guard = policies.last_admin_guard(n, removing_an_admin=True)
        if guard:
            raise InvalidStateTransition(detail=guard)

    await session.execute(
        text(
            "UPDATE role_assignment SET revoked_at = now(), revoked_by = :by, revoke_reason = :rr "
            "WHERE membership_id = :m"
        ),
        {"by": ctx.principal_id, "rr": reason, "m": membership_id},
    )
    await _bump_membership_version(session, row["principal_id"])
    await _audit(session, ctx, "ROLE_REVOKED", target_type="app_user",
                 target_id=row["principal_id"],
                 detail={"role": row["role"], "membership_id": membership_id, "reason": reason})


# --------------------------------------------------------------------------- helpers


async def _role_grants_privileged(session: AsyncSession, role_id: str) -> bool:
    return bool(
        (
            await session.execute(
                text(
                    "SELECT 1 FROM role_permission rp JOIN permission p "
                    "ON p.permission_id = rp.permission_id "
                    "WHERE rp.role_id = :r AND p.is_privileged LIMIT 1"
                ),
                {"r": role_id},
            )
        ).scalar()
    )


async def _count_active_platform_admins(session: AsyncSession, tenant_id: str) -> int:
    return (
        await session.execute(
            text(
                """
                SELECT count(*) FROM role_assignment ra
                JOIN app_user u ON u.user_id = ra.principal_id
                WHERE ra.tenant_id = :t AND ra.role = :role AND ra.scope_type = 'TENANT'
                  AND ra.revoked_at IS NULL AND u.status = 'ACTIVE'
                """
            ),
            {"t": tenant_id, "role": policies.PLATFORM_ADMIN},
        )
    ).scalar()


async def _bump_membership_version(session: AsyncSession, user_id: str) -> None:
    await session.execute(
        text("UPDATE app_user SET membership_version = membership_version + 1 WHERE user_id = :u"),
        {"u": user_id},
    )

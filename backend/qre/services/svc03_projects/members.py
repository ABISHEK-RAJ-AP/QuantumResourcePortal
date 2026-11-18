"""Project membership (project-scoped role assignments)."""

from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from qre.core import authz
from qre.core.context import ResourceRef, TenantContext
from qre.core.errors import ResourceNotFound, ValidationFailed
from qre.core.ids import is_ulid
from qre.services.svc02_identity import admin_service as admin

_COLLAB_ROLES = frozenset({"RESEARCHER", "PROJECT_OWNER", "PROJECT_VIEWER"})
_UI_TO_ROLE = {"editor": "RESEARCHER", "viewer": "PROJECT_VIEWER"}
_ROLE_TO_UI = {
    "RESEARCHER": "editor",
    "PROJECT_OWNER": "editor",
    "PROJECT_VIEWER": "viewer",
}


async def _assert_project(session: AsyncSession, ctx: TenantContext, project_id: str) -> None:
    if not is_ulid(project_id):
        raise ValidationFailed(field_errors={"project_id": "Invalid project id."})
    row = (
        await session.execute(
            text("SELECT tenant_id FROM project WHERE project_id = :p"),
            {"p": project_id},
        )
    ).scalar()
    if row != ctx.tenant_id:
        raise ResourceNotFound()
    authz.get().require(ctx, "project:read", ResourceRef.project(ctx.tenant_id, project_id))


async def list_project_members(
    session: AsyncSession, ctx: TenantContext, project_id: str
) -> dict:
    await _assert_project(session, ctx, project_id)
    rows = (
        await session.execute(
            text(
                """
                SELECT ra.membership_id, u.username, ra.role, ra.granted_at
                FROM role_assignment ra
                JOIN app_user u ON u.user_id = ra.principal_id
                WHERE ra.tenant_id = :t AND ra.scope_type = 'PROJECT'
                  AND ra.scope_id = :p AND ra.revoked_at IS NULL
                  AND ra.role = ANY(:roles)
                ORDER BY u.username
                """
            ),
            {"t": ctx.tenant_id, "p": project_id, "roles": list(_COLLAB_ROLES)},
        )
    ).mappings().all()
    items = [
        {
            "membership_id": r["membership_id"],
            "username": r["username"],
            "role": _ROLE_TO_UI.get(r["role"], r["role"].lower()),
            "granted_at": r["granted_at"].isoformat() if r.get("granted_at") else None,
        }
        for r in rows
    ]
    return {"items": items}


async def add_project_member(
    session: AsyncSession,
    ctx: TenantContext,
    project_id: str,
    *,
    username: str,
    role: str,
) -> dict:
    if role not in _UI_TO_ROLE:
        raise ValidationFailed(field_errors={"role": "Role must be editor or viewer."})
    await _assert_project(session, ctx, project_id)
    authz.get().require(
        ctx, "membership:admin", ResourceRef.project(ctx.tenant_id, project_id)
    )
    uname = username.strip().lower()
    if not uname:
        raise ValidationFailed(field_errors={"username": "Username is required."})
    user_id = (
        await session.execute(
            text("SELECT user_id FROM app_user WHERE username = :u AND home_tenant_id = :t"),
            {"u": uname, "t": ctx.tenant_id},
        )
    ).scalar()
    if not user_id:
        raise ValidationFailed(field_errors={"username": "User not found in this tenant."})
    role_code = _UI_TO_ROLE[role]
    existing = (
        await session.execute(
            text(
                """
                SELECT 1 FROM role_assignment
                WHERE tenant_id = :t AND principal_id = :u AND scope_type = 'PROJECT'
                  AND scope_id = :p AND revoked_at IS NULL AND role = ANY(:roles)
                """
            ),
            {"t": ctx.tenant_id, "u": user_id, "p": project_id, "roles": list(_COLLAB_ROLES)},
        )
    ).scalar()
    if existing:
        raise ValidationFailed(field_errors={"username": "User is already a project member."})
    await admin.grant_membership(
        session,
        ctx,
        principal_id=str(user_id),
        role_code=role_code,
        scope_type="PROJECT",
        scope_id=project_id,
    )
    return {"username": uname, "role": role}
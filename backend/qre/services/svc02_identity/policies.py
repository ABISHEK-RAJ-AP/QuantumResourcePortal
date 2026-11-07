"""Pure authorisation policies for role administration (plan §9: anti-escalation, last admin).

No I/O: the service fetches the rows and locks, then calls these with plain facts so they unit-test
without a database. Each function returns ``None`` when allowed, else a short reason string.
"""

from __future__ import annotations

from dataclasses import dataclass

from qre.core.context import TenantContext

PLATFORM_ADMIN = "PLATFORM_ADMIN"


@dataclass(frozen=True)
class ActorAdminScope:
    """What role administration the actor may do, from their membership:admin grants."""

    is_tenant_admin: bool
    project_admin_ids: frozenset[str]  # projects where the actor holds membership:admin


def actor_admin_scope(ctx: TenantContext) -> ActorAdminScope:
    tenant = any(
        g.permission == "membership:admin" and g.scope_type == "TENANT" for g in ctx.grants
    )
    projects = frozenset(
        g.scope_id
        for g in ctx.grants
        if g.permission == "membership:admin" and g.scope_type == "PROJECT" and g.scope_id
    )
    return ActorAdminScope(is_tenant_admin=tenant, project_admin_ids=projects)


def can_grant_role(
    actor: ActorAdminScope,
    *,
    role_code: str,
    role_scope: str,  # the role's assignable_scope
    is_system: bool,
    role_is_privileged: bool,  # the role grants at least one privileged permission
    target_scope_type: str,
    target_scope_id: str | None,
) -> str | None:
    """Decide whether *actor* may grant this role at the requested scope (S-2).

    Rules:
      * TENANT-scoped roles, PLATFORM_ADMIN, and any role granting a privileged permission may be
        granted only by a tenant administrator.
      * A project administrator may grant only PROJECT-scoped, non-privileged roles, and only in a
        project they administer.
      * PROVIDER-scoped roles are platform-level and require a tenant administrator.
    """
    if target_scope_type != role_scope:
        return f"role {role_code} must be assigned at {role_scope} scope, not {target_scope_type}"

    needs_tenant_admin = (
        role_scope in ("TENANT", "PROVIDER")
        or role_code == PLATFORM_ADMIN
        or role_is_privileged
    )
    if needs_tenant_admin:
        if not actor.is_tenant_admin:
            return f"granting {role_code} requires a tenant administrator"
        return None

    # PROJECT-scoped, non-privileged role.
    if actor.is_tenant_admin:
        return None
    if target_scope_id is not None and target_scope_id in actor.project_admin_ids:
        return None
    return f"you may grant {role_code} only in a project you administer"


def can_revoke_assignment(
    actor: ActorAdminScope,
    *,
    assignment_role: str,
    assignment_scope_type: str,
    assignment_scope_id: str | None,
) -> str | None:
    """Decide whether *actor* may revoke an existing assignment (mirror of grant authority)."""
    if assignment_scope_type in ("TENANT", "PROVIDER") or assignment_role == PLATFORM_ADMIN:
        if not actor.is_tenant_admin:
            return (f"revoking a {assignment_scope_type.lower()} assignment "
                    "requires a tenant administrator")
        return None
    if actor.is_tenant_admin:
        return None
    if assignment_scope_id is not None and assignment_scope_id in actor.project_admin_ids:
        return None
    return "you may revoke assignments only in a project you administer"


def last_admin_guard(active_platform_admins: int, *, removing_an_admin: bool) -> str | None:
    """Prevent removing or disabling the last active PLATFORM_ADMIN of a tenant (S-7)."""
    if removing_an_admin and active_platform_admins <= 1:
        return "cannot remove the last active platform administrator"
    return None


def can_grant_permission_set(
    actor: ActorAdminScope, *, contains_privileged: bool
) -> str | None:
    """A custom role may include privileged permissions only when edited by a tenant admin."""
    if contains_privileged and not actor.is_tenant_admin:
        return "only a tenant administrator may put privileged permissions in a role"
    return None

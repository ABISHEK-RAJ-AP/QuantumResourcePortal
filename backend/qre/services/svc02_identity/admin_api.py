"""RBAC administration endpoints (RBAC-5): roles, permissions, users, memberships, /authz/check.

Each route is gated by a coarse permission (require_permission); fine-grained anti-escalation and
last-admin rules live in admin_service/policies. DTOs forbid unknown fields (mass-assignment
defence, plan S-10). The request-scoped AsyncSession is shared with get_ctx, so a handler and its
audit write commit together.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Header, Response
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.ext.asyncio import AsyncSession

from qre.core.authz import get as get_authorizer
from qre.core.context import ResourceRef, TenantContext
from qre.core.deps import db_session, get_ctx, require_permission
from qre.services.svc02_identity import admin_service as svc

router = APIRouter(prefix="/admin", tags=["rbac-admin"])


class RoleCreateIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    code: str = Field(pattern=r"^[A-Z][A-Z0-9_]{2,31}$")
    name: str = Field(min_length=1, max_length=100)
    description: str = Field(default="", max_length=500)
    assignable_scope: str
    permission_codes: list[str] = Field(default_factory=list)


class RoleUpdateIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str | None = Field(default=None, max_length=100)
    description: str | None = Field(default=None, max_length=500)


class PermissionSetIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    permission_codes: list[str]


class UserCreateIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    username: str = Field(min_length=3, max_length=128)
    display_name: str = Field(min_length=1, max_length=200)
    email: str | None = None
    password: str | None = Field(default=None, min_length=12, max_length=256)


class MembershipIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    principal_id: str
    role_code: str
    scope_type: str
    scope_id: str | None = None


class RevokeIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    reason: str | None = Field(default=None, max_length=500)


class AuthzCheckIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    permission: str
    resource_type: str | None = None  # project | provider | tenant
    resource_id: str | None = None


# --------------------------------------------------------------------------- roles


@router.get("/roles")
async def list_roles(
    ctx: TenantContext = Depends(require_permission("role:read")),
    session: AsyncSession = Depends(db_session),
) -> dict:
    return {"items": await svc.list_roles(session, ctx)}


@router.post("/roles", status_code=201)
async def create_role(
    body: RoleCreateIn,
    ctx: TenantContext = Depends(require_permission("role:create")),
    session: AsyncSession = Depends(db_session),
) -> dict:
    return await svc.create_role(
        session, ctx, code=body.code, name=body.name, description=body.description,
        assignable_scope=body.assignable_scope, permission_codes=body.permission_codes,
    )


@router.get("/roles/{role_id}")
async def get_role(
    role_id: str,
    ctx: TenantContext = Depends(require_permission("role:read")),
    session: AsyncSession = Depends(db_session),
) -> dict:
    return await svc.get_role(session, ctx, role_id)


@router.patch("/roles/{role_id}")
async def update_role(
    role_id: str, body: RoleUpdateIn,
    if_match: int | None = Header(default=None, alias="If-Match"),
    ctx: TenantContext = Depends(require_permission("role:update")),
    session: AsyncSession = Depends(db_session),
) -> dict:
    return await svc.update_role(
        session, ctx, role_id, name=body.name, description=body.description, if_match=if_match
    )


@router.post("/roles/{role_id}/activate")
async def activate_role(
    role_id: str,
    ctx: TenantContext = Depends(require_permission("role:update")),
    session: AsyncSession = Depends(db_session),
) -> dict:
    return await svc.set_role_status(session, ctx, role_id, active=True)


@router.post("/roles/{role_id}/deactivate")
async def deactivate_role(
    role_id: str,
    ctx: TenantContext = Depends(require_permission("role:update")),
    session: AsyncSession = Depends(db_session),
) -> dict:
    return await svc.set_role_status(session, ctx, role_id, active=False)


@router.put("/roles/{role_id}/permissions")
async def set_role_permissions(
    role_id: str, body: PermissionSetIn,
    if_match: int | None = Header(default=None, alias="If-Match"),
    ctx: TenantContext = Depends(require_permission("role:update")),
    session: AsyncSession = Depends(db_session),
) -> dict:
    return await svc.set_role_permissions(
        session, ctx, role_id, permission_codes=body.permission_codes, if_match=if_match
    )


@router.delete("/roles/{role_id}", status_code=204)
async def delete_role(
    role_id: str,
    ctx: TenantContext = Depends(require_permission("role:delete")),
    session: AsyncSession = Depends(db_session),
) -> Response:
    await svc.delete_role(session, ctx, role_id)
    return Response(status_code=204)


@router.get("/roles/{role_id}/users")
async def role_users(
    role_id: str,
    ctx: TenantContext = Depends(require_permission("role:read")),
    session: AsyncSession = Depends(db_session),
) -> dict:
    return {"items": await svc.list_role_users(session, ctx, role_id)}


# --------------------------------------------------------------------------- permissions


@router.get("/permissions")
async def list_permissions(
    ctx: TenantContext = Depends(require_permission("permission:read")),
    session: AsyncSession = Depends(db_session),
) -> dict:
    return {"items": await svc.list_permissions(session, ctx)}


# --------------------------------------------------------------------------- users


@router.get("/users")
async def list_users(
    ctx: TenantContext = Depends(require_permission("user:read")),
    session: AsyncSession = Depends(db_session),
) -> dict:
    return {"items": await svc.list_users(session, ctx)}


@router.post("/users", status_code=201)
async def create_user(
    body: UserCreateIn,
    ctx: TenantContext = Depends(require_permission("user:create")),
    session: AsyncSession = Depends(db_session),
) -> dict:
    return await svc.create_user(
        session, ctx, username=body.username, display_name=body.display_name,
        email=body.email, password=body.password,
    )


@router.post("/users/{user_id}/activate")
async def activate_user(
    user_id: str,
    ctx: TenantContext = Depends(require_permission("user:update")),
    session: AsyncSession = Depends(db_session),
) -> dict:
    return await svc.set_user_status(session, ctx, user_id, active=True)


@router.post("/users/{user_id}/deactivate")
async def deactivate_user(
    user_id: str,
    ctx: TenantContext = Depends(require_permission("user:update")),
    session: AsyncSession = Depends(db_session),
) -> dict:
    return await svc.set_user_status(session, ctx, user_id, active=False)


@router.get("/users/{user_id}/effective-permissions")
async def user_effective_permissions(
    user_id: str,
    ctx: TenantContext = Depends(require_permission("user:read")),
    session: AsyncSession = Depends(db_session),
) -> dict:
    return await svc.get_user_effective_permissions(session, ctx, user_id)


# --------------------------------------------------------------------------- memberships


@router.get("/memberships")
async def list_memberships(
    principal_id: str | None = None,
    ctx: TenantContext = Depends(require_permission("membership:read")),
    session: AsyncSession = Depends(db_session),
) -> dict:
    return {"items": await svc.list_memberships(session, ctx, principal_id=principal_id or None)}


@router.post("/memberships", status_code=201)
async def grant_membership(
    body: MembershipIn,
    ctx: TenantContext = Depends(require_permission("membership:admin")),
    session: AsyncSession = Depends(db_session),
) -> dict:
    return await svc.grant_membership(
        session, ctx, principal_id=body.principal_id, role_code=body.role_code,
        scope_type=body.scope_type, scope_id=body.scope_id,
    )


@router.delete("/memberships/{membership_id}", status_code=204)
async def revoke_membership(
    membership_id: str, body: RevokeIn | None = None,
    ctx: TenantContext = Depends(require_permission("membership:admin")),
    session: AsyncSession = Depends(db_session),
) -> Response:
    await svc.revoke_membership(
        session, ctx, membership_id, reason=(body.reason if body else None)
    )
    return Response(status_code=204)


# --------------------------------------------------------------------------- self authz check


authz_router = APIRouter(tags=["identity"])


@authz_router.post("/authz/check")
async def authz_check(
    body: AuthzCheckIn,
    ctx: TenantContext = Depends(get_ctx),
) -> dict:
    """Answer whether the *calling* principal may perform a permission on a resource (self only)."""
    get_authorizer().catalogue.validate(body.permission)
    resource = None
    if body.resource_type == "project" and body.resource_id:
        resource = ResourceRef.project(ctx.tenant_id, body.resource_id)
    elif body.resource_type == "provider" and body.resource_id:
        resource = ResourceRef.provider(ctx.tenant_id, body.resource_id)
    elif body.resource_type == "tenant":
        resource = ResourceRef.tenant(ctx.tenant_id)
    allowed = get_authorizer().can(ctx, body.permission, resource)
    return {"allowed": allowed, "permission": body.permission,
            "resource_type": body.resource_type, "resource_id": body.resource_id}

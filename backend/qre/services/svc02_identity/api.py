"""SVC-02 HTTP surface: authentication and the server-derived /me endpoints (RBAC-4).

API-IAM-01 (login), API-IAM-05 (logout), API-IAM-06 (/me, /me/navigation), plus /me/permissions.
Role administration (API-IAM-07) and the RBAC admin screens arrive in RBAC-5. A demo
``/rbac/ping`` route exercises the authorisation gate for the test suite.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from qre.core import authz
from qre.core.context import TenantContext
from qre.core.deps import db_session, get_ctx, require_permission
from qre.services.svc02_identity.service import (
    AuthInvalidCredentials,
    LoginSuccess,
    login_local,
    logout,
)

router = APIRouter(tags=["identity"])


class LoginIn(BaseModel):
    model_config = {"extra": "forbid"}
    username: str = Field(min_length=1, max_length=128)
    password: str = Field(min_length=1, max_length=256)
    # CAPTCHA fields are accepted but only validated when QRE_CAPTCHA_ENABLED (SRS §4.2.1).
    captcha_id: str | None = None
    captcha_code: str | None = None


class PrincipalOut(BaseModel):
    principal_id: str
    username: str
    display_name: str
    tenant_id: str


class LoginOut(BaseModel):
    status: str
    principal: PrincipalOut
    csrf_token: str


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "0.0.0.0"  # noqa: S104 — placeholder, not a bind


def _set_session_cookie(request: Request, response: Response, sid: str) -> None:
    settings = request.app.state.settings
    response.set_cookie(
        key=settings.session_cookie_name,
        value=sid,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        path="/",
        max_age=settings.session_absolute_h * 3600,
    )


@router.post("/auth/login", response_model=LoginOut)
async def auth_login(
    body: LoginIn, request: Request, response: Response,
    session: AsyncSession = Depends(db_session),
) -> LoginOut:
    settings = request.app.state.settings
    corr = request.scope.get("state", {}).get("correlation_id", "-")
    try:
        result: LoginSuccess = await login_local(
            session, settings, username=body.username, password=body.password,
            ip=_client_ip(request), correlation_id=corr,
        )
    except AuthInvalidCredentials:
        # Persist the failure bookkeeping (attempt log, lockout counter, LOGIN_FAILED audit) even
        # though the request returns 401 — otherwise the request rollback would erase the lockout.
        await session.commit()
        raise
    _set_session_cookie(request, response, result.sid)
    return LoginOut(
        status="AUTHENTICATED",
        principal=PrincipalOut(
            principal_id=result.principal_id, username=result.username,
            display_name=result.display_name, tenant_id=result.tenant_id,
        ),
        csrf_token=result.csrf,
    )


@router.post("/auth/logout")
async def auth_logout(
    request: Request, response: Response,
    ctx: TenantContext = Depends(get_ctx),
    session: AsyncSession = Depends(db_session),
) -> dict:
    settings = request.app.state.settings
    sid = request.cookies.get(settings.session_cookie_name)
    if sid:
        await logout(session, sid, correlation_id=ctx.correlation_id)
    response.delete_cookie(settings.session_cookie_name, path="/")
    return {"status": "SIGNED_OUT"}


@router.get("/me")
async def me(
    ctx: TenantContext = Depends(get_ctx),
    session: AsyncSession = Depends(db_session),
) -> dict:
    from sqlalchemy import text

    roles = (
        await session.execute(
            text(
                "SELECT DISTINCT role FROM role_assignment "
                "WHERE tenant_id = :t AND principal_id = :p AND revoked_at IS NULL ORDER BY role"
            ),
            {"t": ctx.tenant_id, "p": ctx.principal_id},
        )
    ).scalars().all()
    return {
        "authenticated": True,
        "principal_id": ctx.principal_id,
        "principal_type": ctx.principal_type,
        "tenant_id": ctx.tenant_id,
        "roles": list(roles),
        "permissions": sorted(ctx.permissions()),
    }


@router.get("/auth/csrf")
async def auth_csrf(
    request: Request,
    ctx: TenantContext = Depends(get_ctx),
    session: AsyncSession = Depends(db_session),
) -> dict:
    """Issue a fresh CSRF token for the current session (the SPA holds it in memory only, so a
    page reload re-fetches it — LLD §11.6 forbids storing it). Rotating the token is safe."""
    from sqlalchemy import text

    from qre.core.security import new_csrf_token, sha256_hex

    settings = request.app.state.settings
    sid = request.cookies.get(settings.session_cookie_name)
    token = new_csrf_token()
    await session.execute(
        text("UPDATE session SET csrf_hash = :h WHERE sid_hash = :s"),
        {"h": sha256_hex(token), "s": sha256_hex(sid or "")},
    )
    return {"csrf_token": token}


@router.get("/me/navigation")
async def me_navigation(ctx: TenantContext = Depends(get_ctx)) -> dict:
    return {"items": authz.get().visible_modules(ctx)}


@router.get("/me/permissions")
async def me_permissions(ctx: TenantContext = Depends(get_ctx)) -> dict:
    grants = [
        {"permission": g.permission, "scope_type": g.scope_type, "scope_id": g.scope_id}
        for g in sorted(ctx.grants, key=lambda g: (g.permission, g.scope_type))
    ]
    return {"permissions": sorted(ctx.permissions()), "grants": grants}


# Demo gate used by the test suite to prove the authorisation dependency (TC-IAM-010, TC-SHL-002).
ping_router = APIRouter(tags=["identity"])


@ping_router.get("/rbac/ping-approvals")
async def ping_approvals(ctx: TenantContext = Depends(require_permission("approval:read"))) -> dict:
    return {"ok": True, "permission": "approval:read"}


@ping_router.get("/rbac/ping-roles")
async def ping_roles(ctx: TenantContext = Depends(require_permission("role:read"))) -> dict:
    return {"ok": True, "permission": "role:read"}

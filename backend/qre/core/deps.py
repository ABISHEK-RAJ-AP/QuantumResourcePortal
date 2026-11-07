"""FastAPI authorisation dependencies (LLD §4.1.3, plan §5.3). Deny by default.

``get_ctx`` resolves the session cookie into a TenantContext and enforces CSRF on unsafe methods;
``require_permission`` / ``require_role`` gate a route and audit AUTHZ_DENIED in their own short
transaction so a denial is never turned into a 500 (plan S-17).
"""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator, Callable, Coroutine
from typing import Any

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from qre.core import authz
from qre.core.config import Settings
from qre.core.context import TenantContext
from qre.core.errors import AuthRequired, Forbidden, QreError
from qre.core.security import constant_time_equals, sha256_hex
from qre.services.svc02_identity.service import resolve_context
from qre.services.svc17_audit.service import write_audit_async

_UNSAFE = {"POST", "PUT", "PATCH", "DELETE"}


class CsrfFailed(QreError):
    code = "AUTH_CSRF_FAILED"


async def db_session(request: Request) -> AsyncIterator[AsyncSession]:
    """One request-scoped AsyncSession, committed on success and rolled back on error."""
    db = request.app.state.db
    async with db.sessionmaker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


def _settings(request: Request) -> Settings:
    return request.app.state.settings


def _correlation_id(request: Request) -> str:
    return request.scope.get("state", {}).get("correlation_id", "-")


async def get_ctx(
    request: Request,
    session: AsyncSession = Depends(db_session),
) -> TenantContext:
    """Context from the qre_sid cookie; 401 when absent/expired, 403 on CSRF failure."""
    settings = _settings(request)
    sid = request.cookies.get(settings.session_cookie_name)
    if not sid:
        raise AuthRequired()
    ctx, csrf_hash = await resolve_context(
        session, settings, sid=sid, correlation_id=_correlation_id(request)
    )
    # CSRF synchroniser token on unsafe methods (LLD §11.6).
    if request.method in _UNSAFE:
        header = request.headers.get("X-CSRF-Token", "")
        if not header or not constant_time_equals(sha256_hex(header), csrf_hash):
            raise CsrfFailed()
    request.scope.setdefault("state", {})["ctx"] = ctx
    return ctx


async def _audit_denied(request: Request, ctx: TenantContext, permission: str) -> None:
    """Record AUTHZ_DENIED in its own transaction so the 403 is never masked by an audit failure."""
    db = request.app.state.db
    try:
        async with db.sessionmaker() as s:
            await write_audit_async(
                s, tenant_id=ctx.tenant_id, action="AUTHZ_DENIED", actor_id=ctx.principal_id,
                outcome="DENIED", target_type="permission", target_id=permission,
                detail={"method": request.method, "path": request.url.path},
                correlation_id=_correlation_id(request),
            )
            await s.commit()
    except Exception:  # noqa: S110 — auditing must never convert a 403 into a 500
        logging.getLogger("qre.authz").warning("failed to write AUTHZ_DENIED audit", exc_info=True)


def require_permission(permission: str) -> Callable[..., Coroutine[Any, Any, TenantContext]]:
    """Gate a route on holding *permission* in any scope; resource checks run in the handler."""
    authz.catalogue().validate(permission)

    async def _dep(request: Request, ctx: TenantContext = Depends(get_ctx)) -> TenantContext:
        if not authz.get().has_permission(ctx, permission):
            await _audit_denied(request, ctx, permission)
            raise Forbidden(detail=f"Missing permission {permission}.")
        return ctx

    return _dep


def require_any_permission(*permissions: str) -> Callable[..., Coroutine[Any, Any, TenantContext]]:
    for p in permissions:
        authz.catalogue().validate(p)

    async def _dep(request: Request, ctx: TenantContext = Depends(get_ctx)) -> TenantContext:
        if not any(authz.get().has_permission(ctx, p) for p in permissions):
            await _audit_denied(request, ctx, "|".join(permissions))
            raise Forbidden(detail=f"Requires one of: {', '.join(permissions)}.")
        return ctx

    return _dep


def require_all_permissions(*permissions: str) -> Callable[..., Coroutine[Any, Any, TenantContext]]:
    for p in permissions:
        authz.catalogue().validate(p)

    async def _dep(request: Request, ctx: TenantContext = Depends(get_ctx)) -> TenantContext:
        missing = [p for p in permissions if not authz.get().has_permission(ctx, p)]
        if missing:
            await _audit_denied(request, ctx, "&".join(missing))
            raise Forbidden(detail=f"Requires all of: {', '.join(permissions)}.")
        return ctx

    return _dep


def require_role(role_code: str) -> Callable[..., Coroutine[Any, Any, TenantContext]]:
    """Gate on holding a named role (used only where the LLD names a role, e.g. bootstrap paths)."""

    async def _dep(
        request: Request, ctx: TenantContext = Depends(get_ctx),
        session: AsyncSession = Depends(db_session),
    ) -> TenantContext:
        from sqlalchemy import text

        held = (
            await session.execute(
                text(
                    "SELECT 1 FROM role_assignment WHERE tenant_id=:t AND principal_id=:p "
                    "AND role=:r AND revoked_at IS NULL LIMIT 1"
                ),
                {"t": ctx.tenant_id, "p": ctx.principal_id, "r": role_code},
            )
        ).scalar()
        if not held:
            await _audit_denied(request, ctx, f"role:{role_code}")
            raise Forbidden(detail=f"Requires role {role_code}.")
        return ctx

    return _dep

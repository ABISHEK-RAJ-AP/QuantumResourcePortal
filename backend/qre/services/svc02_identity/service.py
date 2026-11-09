"""SVC-02 authentication and context resolution (LLD §4.3.2, RBAC-4).

Local login with Argon2id, timing-equalised generic failures (REQ-007), lockout (PD-12), opaque
server-side sessions with CSRF, and per-request TenantContext built from the principal's current
assignments (REQ-006 — never from client headers). Login/logout and failures are audited.
"""

from __future__ import annotations

import unicodedata
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from qre.core.config import Settings
from qre.core.context import TenantContext
from qre.core.errors import AuthRequired, QreError
from qre.core.security import verify_password
from qre.services.svc02_identity import repository as repo
from qre.services.svc17_audit.service import write_audit_async


class AuthInvalidCredentials(QreError):
    code = "AUTH_INVALID_CREDENTIALS"


class AuthSessionExpired(QreError):
    code = "AUTH_SESSION_EXPIRED"


@dataclass(frozen=True)
class LoginSuccess:
    sid: str
    csrf: str
    principal_id: str
    tenant_id: str
    username: str
    display_name: str


def normalise_username(raw: str) -> str:
    return unicodedata.normalize("NFKC", raw).strip().lower()


async def login_local(
    session: AsyncSession, settings: Settings, *, username: str, password: str, ip: str,
    correlation_id: str = "-",
) -> LoginSuccess:
    """Authenticate a local principal. Raises AuthInvalidCredentials generically on any failure."""
    uname = normalise_username(username)
    user = await repo.find_user_for_login(session, uname)
    await repo.record_login_attempt(session, uname, ip, "ATTEMPT")

    # Unknown user: run a dummy verify so timing matches, then fail generically (REQ-007).
    if user is None:
        verify_password(None, password)
        raise AuthInvalidCredentials()

    locked = user.locked_until is not None and user.locked_until > datetime.now(UTC)
    inactive = user.status != "ACTIVE" or user.tenant_status != "ACTIVE"

    if locked or inactive or not verify_password(user.password_hash, password):
        if not locked and not inactive:
            await repo.register_failure(
                session, user.user_id,
                threshold=settings.auth_lockout_threshold,
                window_min=settings.auth_lockout_window_min,
                lock_min=settings.auth_lockout_minutes,
            )
        await write_audit_async(
            session, tenant_id=user.home_tenant_id, action="LOGIN_FAILED",
            actor_id=user.user_id, outcome="DENIED",
            detail={"reason": "locked" if locked else "inactive" if inactive else "bad_password"},
            correlation_id=correlation_id, ip=ip,
        )
        raise AuthInvalidCredentials()

    # Success: clear failures, open a session, rotate id (new row), audit.
    await repo.reset_failures(session, user.user_id)
    sid, csrf = await repo.create_session(
        session, tenant_id=user.home_tenant_id, principal_id=user.user_id,
        principal_type="USER", membership_version=user.membership_version,
    )
    await write_audit_async(
        session, tenant_id=user.home_tenant_id, action="LOGIN_SUCCESS",
        actor_id=user.user_id, correlation_id=correlation_id, ip=ip,
    )
    return LoginSuccess(
        sid=sid, csrf=csrf, principal_id=user.user_id, tenant_id=user.home_tenant_id,
        username=user.username, display_name=user.display_name,
    )


async def logout(session: AsyncSession, sid: str, *, correlation_id: str = "-") -> None:
    row = await repo.get_session(session, sid)
    await repo.revoke_session(session, sid)
    if row is not None:
        await write_audit_async(
            session, tenant_id=row.tenant_id, action="LOGOUT",
            actor_id=row.principal_id, correlation_id=correlation_id,
        )


async def resolve_context(
    session: AsyncSession, settings: Settings, *, sid: str, correlation_id: str,
) -> tuple[TenantContext, str]:
    """Validate the session and build the per-request TenantContext, returning (ctx, csrf_hash).

    Raises AuthSessionExpired when the session is missing, revoked or timed out. Grants are read
    fresh every call, so a revoked role is honoured on the next request (REQ-006, TC-IAM-002).
    """
    row = await repo.get_session(session, sid)
    if row is None or repo.is_expired(
        row, idle_min=settings.session_idle_min, absolute_h=settings.session_absolute_h
    ):
        raise AuthSessionExpired()

    await repo.touch_session(session, sid)
    grants = await repo.grants_for_principal(session, row.tenant_id, row.principal_id)
    ctx = TenantContext(
        tenant_id=row.tenant_id,
        principal_id=row.principal_id,
        principal_type=row.principal_type,
        correlation_id=correlation_id,
        grants=grants,
        membership_version=row.membership_version,
    )
    return ctx, row.csrf_hash


def require_authenticated(ctx: TenantContext | None) -> TenantContext:
    if ctx is None:
        raise AuthRequired()
    return ctx

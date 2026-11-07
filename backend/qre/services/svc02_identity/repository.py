"""Async data access for SVC-02 identity and authorisation (RBAC-4).

Plain SQL through the AsyncSession — tenant-scoped reads, grant resolution, session and lockout
bookkeeping. The Authorizer and AuthService call these; nothing here makes authorisation decisions.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from qre.core.context import Grant
from qre.core.security import new_csrf_token, new_session_token, sha256_hex


@dataclass(frozen=True)
class UserRow:
    user_id: str
    home_tenant_id: str
    username: str
    status: str
    display_name: str
    email: str | None
    membership_version: int
    password_hash: str | None
    locked_until: datetime | None
    failed_count: int
    tenant_status: str


async def find_user_for_login(session: AsyncSession, username: str) -> UserRow | None:
    row = (
        await session.execute(
            text(
                """
                SELECT u.user_id, u.home_tenant_id, u.username, u.status, u.display_name, u.email,
                       u.membership_version, c.password_hash, c.locked_until, c.failed_count,
                       t.status AS tenant_status
                FROM app_user u
                LEFT JOIN user_credential c ON c.user_id = u.user_id
                JOIN tenant t ON t.tenant_id = u.home_tenant_id
                WHERE u.username = :u
                """
            ),
            {"u": username},
        )
    ).mappings().first()
    return UserRow(**row) if row else None


async def record_login_attempt(
    session: AsyncSession, username: str, ip: str, outcome: str
) -> None:
    from qre.core.ids import new_ulid

    await session.execute(
        text(
            "INSERT INTO login_attempt (attempt_id, username_hash, ip, outcome) "
            "VALUES (:id, :h, CAST(:ip AS INET), :o)"
        ),
        {"id": new_ulid(), "h": sha256_hex(username), "ip": ip, "o": outcome},
    )


async def register_failure(
    session: AsyncSession, user_id: str, *, threshold: int, window_min: int, lock_min: int
) -> None:
    """Increment the failure counter and lock the credential when the threshold is reached."""
    await session.execute(
        text(
            """
            UPDATE user_credential
            SET failed_count = failed_count + 1,
                locked_until = CASE WHEN failed_count + 1 >= :threshold
                                    THEN now() + make_interval(mins => :lock) ELSE locked_until END
            WHERE user_id = :uid
            """
        ),
        {"uid": user_id, "threshold": threshold, "lock": lock_min},
    )


async def reset_failures(session: AsyncSession, user_id: str) -> None:
    await session.execute(
        text("UPDATE user_credential SET failed_count = 0, locked_until = NULL WHERE user_id = :u"),
        {"u": user_id},
    )


async def grants_for_principal(
    session: AsyncSession, tenant_id: str, principal_id: str
) -> frozenset[Grant]:
    """Effective (permission, scope) grants from active assignments ⋈ active role permissions."""
    rows = (
        await session.execute(
            text(
                """
                SELECT p.code AS permission, ra.scope_type, ra.scope_id
                FROM role_assignment ra
                JOIN role r ON r.role_id = ra.role_id
                               AND r.status = 'ACTIVE' AND r.deleted_at IS NULL
                JOIN role_permission rp ON rp.role_id = r.role_id
                JOIN permission p ON p.permission_id = rp.permission_id AND p.status = 'ACTIVE'
                WHERE ra.tenant_id = :t AND ra.principal_id = :pid AND ra.revoked_at IS NULL
                """
            ),
            {"t": tenant_id, "pid": principal_id},
        )
    ).all()
    return frozenset(Grant(permission=r.permission, scope_type=r.scope_type, scope_id=r.scope_id)
                     for r in rows)


# --------------------------------------------------------------------------- sessions


@dataclass(frozen=True)
class SessionRow:
    tenant_id: str
    principal_id: str
    csrf_hash: str
    membership_version: int
    created_at: datetime
    last_seen_at: datetime
    revoked_at: datetime | None
    principal_type: str = "USER"  # sessions are human principals; services use api_token


async def create_session(
    session: AsyncSession, *, tenant_id: str, principal_id: str, principal_type: str,
    membership_version: int, auth_method: str = "LOCAL",
) -> tuple[str, str]:
    """Create a session row, returning the plaintext (sid, csrf) to put in the cookie/response."""
    sid = new_session_token()
    csrf = new_csrf_token()
    await session.execute(
        text(
            """
            INSERT INTO session (sid_hash, tenant_id, principal_id, csrf_hash, auth_method,
                                 membership_version)
            VALUES (:sid, :t, :pid, :csrf, :m, :mv)
            """
        ),
        {"sid": sha256_hex(sid), "t": tenant_id, "pid": principal_id,
         "csrf": sha256_hex(csrf), "m": auth_method, "mv": membership_version},
    )
    return sid, csrf


async def get_session(session: AsyncSession, sid: str) -> SessionRow | None:
    row = (
        await session.execute(
            text(
                """
                SELECT tenant_id, principal_id, csrf_hash, membership_version,
                       created_at, last_seen_at, revoked_at
                FROM session WHERE sid_hash = :h
                """
            ),
            {"h": sha256_hex(sid)},
        )
    ).mappings().first()
    return SessionRow(**row) if row else None


def is_expired(row: SessionRow, *, idle_min: int, absolute_h: int) -> bool:
    now = datetime.now(UTC)
    if row.revoked_at is not None:
        return True
    if now - row.last_seen_at > timedelta(minutes=idle_min):
        return True
    if now - row.created_at > timedelta(hours=absolute_h):
        return True
    return False


async def touch_session(session: AsyncSession, sid: str) -> None:
    await session.execute(
        text("UPDATE session SET last_seen_at = now() WHERE sid_hash = :h"),
        {"h": sha256_hex(sid)},
    )


async def revoke_session(session: AsyncSession, sid: str) -> None:
    await session.execute(
        text("UPDATE session SET revoked_at = now() WHERE sid_hash = :h AND revoked_at IS NULL"),
        {"h": sha256_hex(sid)},
    )

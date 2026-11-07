"""RBAC-4 authentication and authorisation flow — TC-IAM-* and TC-SHL-002 against PostgreSQL.

Uses the migrated+seeded test database (``migrated_db``) and the ASGI ``client``. A per-test world
seeds a tenant with a PLATFORM_ADMIN and a project-scoped RESEARCHER with known passwords; HTTP
calls go through the real login/session/CSRF path.
"""

from __future__ import annotations

from dataclasses import dataclass

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

from qre.core.ids import new_ulid
from qre.core.security import hash_password
from qre.services.svc02_identity.bootstrap import bootstrap_admin

pytestmark = pytest.mark.db

ADMIN_PW = "Admin-Strong-Pw-2026"
RESEARCHER_PW = "Research-Strong-Pw-9"


@dataclass
class World:
    tenant_id: str
    tenant_code: str
    admin_username: str
    researcher_username: str
    project_id: str


@pytest.fixture
async def engine(migrated_db: str) -> AsyncEngine:
    eng = create_async_engine(migrated_db)
    try:
        yield eng
    finally:
        await eng.dispose()


@pytest.fixture
async def world(engine: AsyncEngine) -> World:
    # Use the ULID's random tail, not its timestamp prefix, so fast-running tests get unique codes.
    code = f"T{new_ulid()[-8:]}"
    admin_u = f"admin_{code.lower()}"
    rs_u = f"rs_{code.lower()}"

    def build(c):
        res = bootstrap_admin(
            c, tenant_code=code, tenant_name="Test", admin_username=admin_u, password=ADMIN_PW
        )
        tid = res.tenant_id
        pid = new_ulid()
        c.execute(
            text("INSERT INTO project (project_id, tenant_id, code, name) VALUES (:p,:t,:c,'P')"),
            {"p": pid, "t": tid, "c": f"PRJ{code}"},
        )
        uid = new_ulid()
        c.execute(
            text("INSERT INTO app_user (user_id, home_tenant_id, username, display_name) "
                 "VALUES (:u,:t,:un,'Researcher')"),
            {"u": uid, "t": tid, "un": rs_u},
        )
        c.execute(
            text("INSERT INTO user_credential (user_id, password_hash) VALUES (:u,:h)"),
            {"u": uid, "h": hash_password(RESEARCHER_PW)},
        )
        rid = c.execute(text("SELECT role_id FROM role WHERE code='RESEARCHER'")).scalar()
        c.execute(
            text("INSERT INTO role_assignment "
                 "(membership_id, tenant_id, principal_id, role, role_id, scope_type, scope_id, granted_by) "
                 "VALUES (:m,:t,:u,'RESEARCHER',:r,'PROJECT',:p,:t)"),
            {"m": new_ulid(), "t": tid, "u": uid, "r": rid, "p": pid},
        )
        return World(tid, code, admin_u, rs_u, pid)

    async with engine.begin() as aconn:
        return await aconn.run_sync(build)


async def login(client, username, password):
    return await client.post("/api/v1/auth/login", json={"username": username, "password": password})


async def audit_rows(engine, tenant_id, action):
    async with engine.connect() as c:
        return (
            await c.execute(
                text("SELECT count(*) FROM audit_log WHERE tenant_id=:t AND action=:a"),
                {"t": tenant_id, "a": action},
            )
        ).scalar()


# --------------------------------------------------------------------------- login / sessions

async def test_login_success_sets_cookie_and_csrf_and_audits(client, engine, world):
    r = await login(client, world.admin_username, ADMIN_PW)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "AUTHENTICATED"
    assert body["csrf_token"]
    assert "qre_sid" in r.cookies
    assert await audit_rows(engine, world.tenant_id, "LOGIN_SUCCESS") == 1


async def test_unknown_user_and_wrong_password_are_indistinguishable(client, world):
    r1 = await login(client, "nobody_" + world.tenant_code.lower(), "whatever-123456")
    r2 = await login(client, world.admin_username, "wrong-password-123")
    assert r1.status_code == r2.status_code == 401
    assert r1.json()["code"] == r2.json()["code"] == "AUTH_INVALID_CREDENTIALS"  # TC-IAM-003


async def test_lockout_after_threshold_failures(client, engine, world):
    for _ in range(5):
        await login(client, world.admin_username, "wrong-pass-000")
    # Correct password now rejected because the credential is locked (TC-IAM-004).
    r = await login(client, world.admin_username, ADMIN_PW)
    assert r.status_code == 401
    assert await audit_rows(engine, world.tenant_id, "LOGIN_FAILED") >= 5


async def test_logout_invalidates_session(client, world):
    r = await login(client, world.admin_username, ADMIN_PW)
    csrf = r.json()["csrf_token"]
    assert (await client.get("/api/v1/me")).status_code == 200
    out = await client.post("/api/v1/auth/logout", headers={"X-CSRF-Token": csrf})
    assert out.status_code == 200
    # The in-client cookie is cleared, and even replaying it would be rejected (TC-IAM-006).
    assert (await client.get("/api/v1/me")).status_code == 401


async def test_idle_timeout_rejects_session(client, engine, world):
    await login(client, world.admin_username, ADMIN_PW)
    # Age the session beyond the idle window without waiting.
    async with engine.begin() as c:
        await c.execute(
            text("UPDATE session SET last_seen_at = now() - interval '2 hours' "
                 "WHERE tenant_id=:t"),
            {"t": world.tenant_id},
        )
    r = await client.get("/api/v1/me")
    assert r.status_code == 401
    assert r.json()["code"] == "AUTH_SESSION_EXPIRED"  # TC-IAM-005


async def test_role_revocation_takes_effect_next_request(client, engine, world):
    await login(client, world.admin_username, ADMIN_PW)
    assert (await client.get("/api/v1/rbac/ping-roles")).status_code == 200  # has role:read
    async with engine.begin() as c:
        await c.execute(
            text("UPDATE role_assignment SET revoked_at = now() "
                 "WHERE tenant_id=:t AND role='PLATFORM_ADMIN'"),
            {"t": world.tenant_id},
        )
    # Grants are re-derived per request, so the next call is denied (TC-IAM-002, REQ-006).
    assert (await client.get("/api/v1/rbac/ping-roles")).status_code == 403


# --------------------------------------------------------------------------- CSRF

async def test_csrf_required_on_unsafe_methods(client, world):
    await login(client, world.admin_username, ADMIN_PW)
    without = await client.post("/api/v1/auth/logout")
    assert without.status_code == 403
    assert without.json()["code"] == "AUTH_CSRF_FAILED"


# --------------------------------------------------------------------------- authorisation / nav

async def test_researcher_navigation_excludes_approvals_and_call_is_denied(client, engine, world):
    await login(client, world.researcher_username, RESEARCHER_PW)
    nav = await client.get("/api/v1/me/navigation")
    routes = {i["route"] for i in nav.json()["items"]}
    assert "/qrp/approvals" not in routes  # TC-SHL-002 (navigation)
    denied = await client.get("/api/v1/rbac/ping-approvals")
    assert denied.status_code == 403  # TC-SHL-002 (API enforced)


async def test_admin_on_admin_route_allowed_researcher_denied_and_audited(client, engine, world):
    # Admin may read roles.
    await login(client, world.admin_username, ADMIN_PW)
    assert (await client.get("/api/v1/rbac/ping-roles")).status_code == 200
    # Researcher may not; the denial is audited (TC-IAM-010).
    await login(client, world.researcher_username, RESEARCHER_PW)
    r = await client.get("/api/v1/rbac/ping-roles")
    assert r.status_code == 403
    assert await audit_rows(engine, world.tenant_id, "AUTHZ_DENIED") >= 1


async def test_me_permissions_reflects_scoped_grants(client, world):
    await login(client, world.researcher_username, RESEARCHER_PW)
    body = (await client.get("/api/v1/me/permissions")).json()
    assert "workload:create" in body["permissions"]
    assert "approval:decide" not in body["permissions"]
    # The researcher's grants are project-scoped.
    assert all(g["scope_type"] == "PROJECT" for g in body["grants"])

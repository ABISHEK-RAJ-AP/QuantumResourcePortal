"""RBAC-5 admin API — role lifecycle, permission edits, memberships, anti-escalation, last admin.

Against PostgreSQL. Reuses the login path: an admin session drives the /admin endpoints over HTTP
with CSRF, so the tests exercise authorisation, the service rules and the DB triggers together.
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
PW = "Member-Strong-Pw-2026"


@dataclass
class World:
    tenant_id: str
    admin_username: str
    project_id: str
    member_user_id: str
    member_username: str


@pytest.fixture
async def engine(migrated_db: str) -> AsyncEngine:
    eng = create_async_engine(migrated_db)
    try:
        yield eng
    finally:
        await eng.dispose()


@pytest.fixture
async def world(engine: AsyncEngine) -> World:
    code = f"T{new_ulid()[-8:]}"
    admin_u = f"admin_{code.lower()}"
    member_u = f"mem_{code.lower()}"

    def build(c):
        res = bootstrap_admin(c, tenant_code=code, tenant_name="T", admin_username=admin_u,
                              password=ADMIN_PW)
        pid = new_ulid()
        c.execute(text("INSERT INTO project (project_id, tenant_id, code, name) VALUES (:p,:t,:c,'P')"),
                  {"p": pid, "t": res.tenant_id, "c": f"PRJ{code}"})
        uid = new_ulid()
        c.execute(text("INSERT INTO app_user (user_id, home_tenant_id, username, display_name) "
                       "VALUES (:u,:t,:un,'M')"), {"u": uid, "t": res.tenant_id, "un": member_u})
        c.execute(text("INSERT INTO user_credential (user_id, password_hash) VALUES (:u,:h)"),
                  {"u": uid, "h": hash_password(PW)})
        return World(res.tenant_id, admin_u, pid, uid, member_u)

    async with engine.begin() as aconn:
        return await aconn.run_sync(build)


async def admin_client(client, username, password=ADMIN_PW):
    r = await client.post("/api/v1/auth/login", json={"username": username, "password": password})
    assert r.status_code == 200, r.text
    client.headers["X-CSRF-Token"] = r.json()["csrf_token"]
    return client


async def audit_count(engine, tenant_id, action):
    async with engine.connect() as c:
        return (await c.execute(
            text("SELECT count(*) FROM audit_log WHERE tenant_id=:t AND action=:a"),
            {"t": tenant_id, "a": action})).scalar()


# --------------------------------------------------------------------------- role lifecycle

async def test_role_crud_lifecycle(client, engine, world):
    await admin_client(client, world.admin_username)
    # create a custom project-scoped role
    r = await client.post("/api/v1/admin/roles", json={
        "code": "LAB_LEAD", "name": "Lab Lead", "assignable_scope": "PROJECT",
        "permission_codes": ["workload:read", "approval:read"]})
    assert r.status_code == 201, r.text
    role = r.json()
    assert set(role["permissions"]) == {"workload:read", "approval:read"}
    rid = role["role_id"]
    # it appears in the list with counts
    listed = (await client.get("/api/v1/admin/roles")).json()["items"]
    assert any(x["role_id"] == rid and x["user_count"] == 0 for x in listed)
    # edit name with correct If-Match
    patched = await client.patch(f"/api/v1/admin/roles/{rid}", json={"name": "Lab Leader"},
                                 headers={"If-Match": str(role["row_version"])})
    assert patched.status_code == 200
    # replace its permission set
    pr = await client.put(f"/api/v1/admin/roles/{rid}/permissions",
                          json={"permission_codes": ["workload:read"]})
    assert pr.status_code == 200
    assert pr.json()["permissions"] == ["workload:read"]
    # delete it
    assert (await client.delete(f"/api/v1/admin/roles/{rid}")).status_code == 204
    assert await audit_count(engine, world.tenant_id, "ROLE_CREATED") == 1
    assert await audit_count(engine, world.tenant_id, "ROLE_DELETED") == 1


async def test_system_roles_are_immutable_via_api(client, world):
    await admin_client(client, world.admin_username)
    roles = (await client.get("/api/v1/admin/roles")).json()["items"]
    admin_role = next(x for x in roles if x["code"] == "PLATFORM_ADMIN")
    rid = admin_role["role_id"]
    assert (await client.patch(f"/api/v1/admin/roles/{rid}", json={"name": "x"})).status_code == 409
    assert (await client.put(f"/api/v1/admin/roles/{rid}/permissions",
                             json={"permission_codes": []})).status_code == 409
    assert (await client.delete(f"/api/v1/admin/roles/{rid}")).status_code == 409
    assert (await client.post(f"/api/v1/admin/roles/{rid}/deactivate")).status_code == 409


async def test_if_match_conflict(client, world):
    await admin_client(client, world.admin_username)
    r = await client.post("/api/v1/admin/roles", json={
        "code": "TMP_ROLE", "name": "Tmp", "assignable_scope": "TENANT", "permission_codes": []})
    rid = r.json()["role_id"]
    conflict = await client.patch(f"/api/v1/admin/roles/{rid}", json={"name": "y"},
                                  headers={"If-Match": "999"})
    assert conflict.status_code == 409
    assert conflict.json()["code"] == "REVISION_CONFLICT"


async def test_duplicate_and_shadow_role_codes_rejected(client, world):
    await admin_client(client, world.admin_username)
    base = {"name": "X", "assignable_scope": "TENANT", "permission_codes": []}
    assert (await client.post("/api/v1/admin/roles", json={**base, "code": "DUP1"})).status_code == 201
    assert (await client.post("/api/v1/admin/roles", json={**base, "code": "DUP1"})).status_code == 409
    # cannot shadow a system role code
    assert (await client.post("/api/v1/admin/roles",
                              json={**base, "code": "AUDITOR"})).status_code == 409


async def test_unknown_permission_code_rejected(client, world):
    await admin_client(client, world.admin_username)
    r = await client.post("/api/v1/admin/roles", json={
        "code": "BADPERM", "name": "X", "assignable_scope": "TENANT",
        "permission_codes": ["not:real"]})
    assert r.status_code == 400
    assert r.json()["code"] == "VALIDATION_FAILED"


async def test_unknown_field_rejected_mass_assignment(client, world):
    await admin_client(client, world.admin_username)
    r = await client.post("/api/v1/admin/roles", json={
        "code": "MASS", "name": "X", "assignable_scope": "TENANT", "permission_codes": [],
        "is_system": True})  # attempt to set is_system
    # extra='forbid' → the gateway maps the validation error to problem+json VALIDATION_FAILED (400)
    assert r.status_code == 400
    assert r.json()["code"] == "VALIDATION_FAILED"


# --------------------------------------------------------------------------- memberships

async def test_grant_and_effective_permissions_and_revoke(client, engine, world):
    await admin_client(client, world.admin_username)
    g = await client.post("/api/v1/admin/memberships", json={
        "principal_id": world.member_user_id, "role_code": "RESEARCHER",
        "scope_type": "PROJECT", "scope_id": world.project_id})
    assert g.status_code == 201, g.text
    mid = g.json()["membership_id"]
    eff = (await client.get(
        f"/api/v1/admin/users/{world.member_user_id}/effective-permissions")).json()
    assert "workload:create" in eff["permissions"]
    # duplicate active grant rejected
    dup = await client.post("/api/v1/admin/memberships", json={
        "principal_id": world.member_user_id, "role_code": "RESEARCHER",
        "scope_type": "PROJECT", "scope_id": world.project_id})
    assert dup.status_code == 409
    # revoke
    assert (await client.request("DELETE", f"/api/v1/admin/memberships/{mid}",
                                 json={"reason": "done"})).status_code == 204
    eff2 = (await client.get(
        f"/api/v1/admin/users/{world.member_user_id}/effective-permissions")).json()
    assert eff2["permissions"] == []
    assert await audit_count(engine, world.tenant_id, "ROLE_GRANTED") == 1
    assert await audit_count(engine, world.tenant_id, "ROLE_REVOKED") == 1


async def test_scope_mismatch_rejected_on_grant(client, world):
    await admin_client(client, world.admin_username)
    # RESEARCHER is PROJECT-scoped; granting at TENANT scope must fail (policy + trigger)
    r = await client.post("/api/v1/admin/memberships", json={
        "principal_id": world.member_user_id, "role_code": "RESEARCHER",
        "scope_type": "TENANT", "scope_id": None})
    assert r.status_code in (403, 409)


# --------------------------------------------------------------------------- anti-escalation

async def test_project_owner_cannot_grant_tenant_role(client, engine, world):
    # Make the member a PROJECT_OWNER of the project (they get membership:admin at project scope).
    await admin_client(client, world.admin_username)
    await client.post("/api/v1/admin/memberships", json={
        "principal_id": world.member_user_id, "role_code": "PROJECT_OWNER",
        "scope_type": "PROJECT", "scope_id": world.project_id})
    # Now log in as that project owner and try to grant a TENANT role to someone.
    # create a victim user
    async with engine.begin() as c:
        vid = new_ulid()
        await c.execute(text("INSERT INTO app_user (user_id, home_tenant_id, username, display_name) "
                             "VALUES (:u,:t,:un,'V')"),
                        {"u": vid, "t": world.tenant_id, "un": f"victim_{vid[:6].lower()}"})
        await c.execute(text("INSERT INTO user_credential (user_id, password_hash) VALUES (:u,:h)"),
                        {"u": vid, "h": hash_password(PW)})
    po_client = await admin_client(client, world.member_username, PW)
    # PROJECT_OWNER lacks role:read etc., but holds membership:admin at project scope.
    r = await po_client.post("/api/v1/admin/memberships", json={
        "principal_id": vid, "role_code": "PLATFORM_ADMIN", "scope_type": "TENANT",
        "scope_id": None})
    assert r.status_code == 403  # anti-escalation (S-2)


# --------------------------------------------------------------------------- last admin

async def test_cannot_revoke_last_platform_admin(client, world):
    await admin_client(client, world.admin_username)
    memberships = (await client.get("/api/v1/admin/memberships")).json()["items"]
    admin_membership = next(m for m in memberships if m["role"] == "PLATFORM_ADMIN")
    r = await client.request("DELETE", f"/api/v1/admin/memberships/{admin_membership['membership_id']}")
    assert r.status_code == 409  # last-admin guard (S-7)
    assert "administrator" in r.json()["detail"]


async def test_authz_check_self(client, world):
    await admin_client(client, world.admin_username)
    r = await client.post("/api/v1/authz/check", json={"permission": "role:read"})
    assert r.json()["allowed"] is True
    r2 = await client.post("/api/v1/authz/check", json={"permission": "approval:decide"})
    assert r2.json()["allowed"] is False  # admin lacks approval:decide

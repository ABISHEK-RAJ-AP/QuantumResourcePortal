"""Projects API — tenant-scoped list, create, and detail (Priority 2 slice)."""

from __future__ import annotations

from dataclasses import dataclass

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine
from tests._credentials import ADMIN_PW, LAB_PASSWORD_MIN_LEN

from qre.core.ids import new_ulid
from qre.core.security import hash_password
from qre.services.svc02_identity.bootstrap import bootstrap_admin

pytestmark = pytest.mark.db

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
    code = f"T{new_ulid()[-8:]}"
    admin_u = f"admin_{code.lower()}"
    rs_u = f"rs_{code.lower()}"

    def build(c):
        res = bootstrap_admin(
            c, tenant_code=code, tenant_name="Test", admin_username=admin_u, password=ADMIN_PW, password_min_len=LAB_PASSWORD_MIN_LEN
        )
        tid = res.tenant_id
        pid = new_ulid()
        c.execute(
            text("INSERT INTO project (project_id, tenant_id, code, name) VALUES (:p,:t,:c,'Seed project')"),
            {"p": pid, "t": tid, "c": f"PRJ{code}"},
        )
        uid = new_ulid()
        c.execute(
            text(
                "INSERT INTO app_user (user_id, home_tenant_id, username, display_name) "
                "VALUES (:u,:t,:un,'Researcher')"
            ),
            {"u": uid, "t": tid, "un": rs_u},
        )
        c.execute(
            text("INSERT INTO user_credential (user_id, password_hash) VALUES (:u,:h)"),
            {"u": uid, "h": hash_password(RESEARCHER_PW)},
        )
        rid = c.execute(text("SELECT role_id FROM role WHERE code='RESEARCHER'")).scalar()
        c.execute(
            text(
                "INSERT INTO role_assignment "
                "(membership_id, tenant_id, principal_id, role, role_id, scope_type, scope_id, granted_by) "
                "VALUES (:m,:t,:u,'RESEARCHER',:r,'PROJECT',:p,:t)"
            ),
            {"m": new_ulid(), "t": tid, "u": uid, "r": rid, "p": pid},
        )
        return World(tid, code, admin_u, rs_u, pid)

    async with engine.begin() as aconn:
        return await aconn.run_sync(build)


async def login(client, username, password):
    return await client.post("/api/v1/auth/login", json={"username": username, "password": password})


async def test_list_projects_scoped_for_researcher(client, world):
    await login(client, world.researcher_username, RESEARCHER_PW)
    r = await client.get("/api/v1/projects")
    assert r.status_code == 200, r.text
    body = r.json()
    assert "items" in body
    ids = {item["project_id"] for item in body["items"]}
    assert world.project_id in ids
    assert all(item.get("name") for item in body["items"])


async def test_admin_lists_all_and_creates_project(client, world):
    login_r = await login(client, world.admin_username, ADMIN_PW)
    csrf = login_r.json()["csrf_token"]
    listed = await client.get("/api/v1/projects")
    assert listed.status_code == 200
    before = len(listed.json()["items"])

    created = await client.post(
        "/api/v1/projects",
        json={"name": "QEC benchmark lane", "description": "Integration test", "project_type": "quantum_circuit"},
        headers={"X-CSRF-Token": csrf},
    )
    assert created.status_code == 201, created.text
    row = created.json()
    assert row["name"] == "QEC benchmark lane"
    assert row["project_id"]
    assert row["project_type"] == "quantum_circuit"
    assert row["is_archived"] is False

    again = await client.get("/api/v1/projects")
    assert len(again.json()["items"]) == before + 1

    detail = await client.get(f"/api/v1/projects/{row['project_id']}")
    assert detail.status_code == 200
    assert detail.json()["name"] == "QEC benchmark lane"


async def test_researcher_cannot_create_without_tenant_scope(client, world):
    login_r = await login(client, world.researcher_username, RESEARCHER_PW)
    csrf = login_r.json()["csrf_token"]
    r = await client.post(
        "/api/v1/projects",
        json={"name": "Should fail"},
        headers={"X-CSRF-Token": csrf},
    )
    assert r.status_code == 403


async def test_detail_unknown_project_is_404(client, world):
    await login(client, world.admin_username, ADMIN_PW)
    missing = new_ulid()
    r = await client.get(f"/api/v1/projects/{missing}")
    assert r.status_code == 404


async def test_project_members_list_and_add(client, world, engine):
    login_r = await login(client, world.admin_username, ADMIN_PW)
    client.headers["X-CSRF-Token"] = login_r.json()["csrf_token"]

    rs_uid = new_ulid()
    code = world.researcher_username.split("_", 1)[-1][:8]

    def add_user(c):
        c.execute(
            text(
                "INSERT INTO app_user (user_id, home_tenant_id, username, display_name) "
                "VALUES (:u,:t,:un,'Extra')"
            ),
            {"u": rs_uid, "t": world.tenant_id, "un": f"collab_{code}"},
        )

    async with engine.begin() as aconn:
        await aconn.run_sync(add_user)

    listed = await client.get(f"/api/v1/projects/{world.project_id}/members")
    assert listed.status_code == 200, listed.text
    before = len(listed.json()["items"])

    added = await client.post(
        f"/api/v1/projects/{world.project_id}/members",
        json={"username": f"collab_{code}", "role": "viewer"},
    )
    assert added.status_code == 201, added.text
    assert added.json()["role"] == "viewer"

    again = await client.get(f"/api/v1/projects/{world.project_id}/members")
    assert len(again.json()["items"]) == before + 1
    usernames = {i["username"] for i in again.json()["items"]}
    assert f"collab_{code}" in usernames
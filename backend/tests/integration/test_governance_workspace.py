"""Projects, workload submissions, approvals, governance summary."""

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
OWNER_PW = "Owner-Strong-Pw-9"


@dataclass
class World:
    tenant_id: str
    admin_username: str
    researcher_username: str
    owner_username: str
    project_id: str
    owner_user_id: str


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
    po_u = f"po_{code.lower()}"

    def build(c):
        res = bootstrap_admin(
            c, tenant_code=code, tenant_name="GovTest", admin_username=admin_u, password=ADMIN_PW, password_min_len=LAB_PASSWORD_MIN_LEN
        )
        tid = res.tenant_id
        pid = new_ulid()
        c.execute(
            text("INSERT INTO project (project_id, tenant_id, code, name) VALUES (:p,:t,:c,'P')"),
            {"p": pid, "t": tid, "c": f"PRJ{code}"},
        )
        rs_uid = new_ulid()
        c.execute(
            text(
                "INSERT INTO app_user (user_id, home_tenant_id, username, display_name) "
                "VALUES (:u,:t,:un,'Researcher')"
            ),
            {"u": rs_uid, "t": tid, "un": rs_u},
        )
        c.execute(
            text("INSERT INTO user_credential (user_id, password_hash) VALUES (:u,:h)"),
            {"u": rs_uid, "h": hash_password(RESEARCHER_PW)},
        )
        rr = c.execute(text("SELECT role_id FROM role WHERE code='RESEARCHER'")).scalar()
        c.execute(
            text(
                "INSERT INTO role_assignment "
                "(membership_id, tenant_id, principal_id, role, role_id, scope_type, scope_id, granted_by) "
                "VALUES (:m,:t,:u,'RESEARCHER',:r,'PROJECT',:p,:t)"
            ),
            {"m": new_ulid(), "t": tid, "u": rs_uid, "r": rr, "p": pid},
        )
        po_uid = new_ulid()
        c.execute(
            text(
                "INSERT INTO app_user (user_id, home_tenant_id, username, display_name) "
                "VALUES (:u,:t,:un,'Owner')"
            ),
            {"u": po_uid, "t": tid, "un": po_u},
        )
        c.execute(
            text("INSERT INTO user_credential (user_id, password_hash) VALUES (:u,:h)"),
            {"u": po_uid, "h": hash_password(OWNER_PW)},
        )
        por = c.execute(text("SELECT role_id FROM role WHERE code='PROJECT_OWNER'")).scalar()
        c.execute(
            text(
                "INSERT INTO role_assignment "
                "(membership_id, tenant_id, principal_id, role, role_id, scope_type, scope_id, granted_by) "
                "VALUES (:m,:t,:u,'PROJECT_OWNER',:r,'PROJECT',:p,:t)"
            ),
            {"m": new_ulid(), "t": tid, "u": po_uid, "r": por, "p": pid},
        )
        return World(tid, admin_u, rs_u, po_u, pid, po_uid)

    async with engine.begin() as aconn:
        return await aconn.run_sync(build)


async def session_client(client, username, password):
    r = await client.post("/api/v1/auth/login", json={"username": username, "password": password})
    assert r.status_code == 200, r.text
    client.headers["X-CSRF-Token"] = r.json()["csrf_token"]
    return client


async def test_projects_empty_then_create(client, world):
    await session_client(client, world.admin_username, ADMIN_PW)
    listed = await client.get("/api/v1/projects")
    assert listed.status_code == 200
    assert listed.json()["items"]  # seeded project from fixture
    created = await client.post(
        "/api/v1/projects",
        json={"name": "Bench lane", "description": "Test", "project_type": "quantum_circuit"},
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["project_id"]
    assert body["name"] == "Bench lane"
    detail = await client.get(f"/api/v1/projects/{body['project_id']}")
    assert detail.status_code == 200
    assert detail.json()["project_id"] == body["project_id"]


async def test_workload_submit_and_approve(client, world):
    await session_client(client, world.researcher_username, RESEARCHER_PW)
    draft = await client.post(
        "/api/v1/workload-submissions",
        json={"project_id": world.project_id, "metadata": {"purpose": "Bell state prep"}},
    )
    assert draft.status_code == 201, draft.text
    sid = draft.json()["submission_id"]
    submitted = await client.post(f"/api/v1/workload-submissions/{sid}/submit-for-review")
    assert submitted.status_code == 200, submitted.text
    wid = submitted.json()["workload_id"]
    assert wid
    detail = await client.get(f"/api/v1/approvals/{wid}")
    assert detail.status_code == 200
    assert detail.json()["governance_state"] == "submitted_for_review"
    summary = await client.get("/api/v1/governance/summary")
    assert summary.status_code == 200
    assert summary.json()["queue"] >= 1
    await session_client(client, world.owner_username, OWNER_PW)
    decided = await client.post(
        f"/api/v1/approvals/{wid}/decide",
        json={
            "decision": "approve",
            "comment": "Looks good for simulator slot",
            "expected_stage_id": "technical",
        },
    )
    assert decided.status_code == 200, decided.text
    assert decided.json()["governance_state"] == "in_review"
    listed = await client.get("/api/v1/approvals?project_id=" + world.project_id)
    assert any(x["workload_id"] == wid for x in listed.json()["items"])


async def test_governance_summary_empty_tenant(client, engine):
    code = f"Z{new_ulid()[-8:]}"
    admin_u = f"admin_{code.lower()}"

    def build(c):
        return bootstrap_admin(
            c, tenant_code=code, tenant_name="Empty", admin_username=admin_u, password=ADMIN_PW, password_min_len=LAB_PASSWORD_MIN_LEN
        )

    async with engine.begin() as aconn:
        await aconn.run_sync(build)
    await session_client(client, admin_u, ADMIN_PW)
    summary = await client.get("/api/v1/governance/summary")
    assert summary.status_code == 200
    body = summary.json()
    assert body["queue"] == 0
    assert body["counts"]["approved"] == 0
    assert "demo" not in body
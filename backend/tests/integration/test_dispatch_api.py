"""Dispatch authorize → record → reconcile and provider jobs."""

from __future__ import annotations

import json

import pytest

from qre.core.ids import new_ulid

pytestmark = pytest.mark.db

ADMIN_PW = "Admin-Strong-Pw-2026"
RESEARCHER_PW = "Research-Strong-Pw-9"


async def login(client, username, password):
    r = await client.post("/api/v1/auth/login", json={"username": username, "password": password})
    assert r.status_code == 200, r.text
    client.headers["X-CSRF-Token"] = r.json()["csrf_token"]


async def approved_workload(client, world):
    await login(client, world.researcher_username, RESEARCHER_PW)
    draft = await client.post(
        "/api/v1/workload-submissions",
        json={"project_id": world.project_id, "metadata": {"shots": 10}},
    )
    sid = draft.json()["submission_id"]
    sub = await client.post(f"/api/v1/workload-submissions/{sid}/submit-for-review")
    wid = sub.json()["workload_id"]
    await login(client, world.admin_username, ADMIN_PW)
    for stage in ("technical", "policy", "quota"):
        r = await client.post(
            f"/api/v1/approvals/{wid}/decide",
            json={"decision": "approve", "comment": "ok", "expected_stage_id": stage},
        )
        assert r.status_code == 200, r.text
    return wid


@pytest.fixture
async def world(client, migrated_db):
    from dataclasses import dataclass

    from sqlalchemy import text
    from sqlalchemy.ext.asyncio import create_async_engine

    from qre.core.security import hash_password
    from qre.services.svc02_identity.bootstrap import bootstrap_admin

    @dataclass
    class World:
        tenant_id: str
        admin_username: str
        researcher_username: str
        project_id: str

    code = f"T{new_ulid()[-8:]}"
    admin_u = f"admin_{code.lower()}"
    rs_u = f"rs_{code.lower()}"
    eng = create_async_engine(migrated_db)

    def build(c):
        res = bootstrap_admin(
            c, tenant_code=code, tenant_name="DispTest", admin_username=admin_u, password=ADMIN_PW
        )
        tid = res.tenant_id
        pid = new_ulid()
        c.execute(
            text("INSERT INTO project (project_id, tenant_id, code, name) VALUES (:p,:t,:c,'P')"),
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
        c.execute(
            text(
                """
                INSERT INTO catalogue_provider (
                    tenant_id, provider_id, provider_name, status, integration, created_by
                ) VALUES (
                    :t, 'p1', 'Provider One', 'active',
                    '{"stage":"I5","manifest_registered"\:true}', :admin
                )
                """
            ),
            {"t": tid, "admin": res.user_id},
        )
        c.execute(
            text(
                """
                INSERT INTO catalogue_backend (
                    tenant_id, backend_id, provider_id, backend_name, operational_status
                ) VALUES (:t, 'bk1', 'p1', 'Backend One', 'ONLINE')
                """
            ),
            {"t": tid},
        )
        return World(tid, admin_u, rs_u, pid)

    async with eng.begin() as aconn:
        w = await aconn.run_sync(build)
    try:
        yield w
    finally:
        await eng.dispose()


async def test_dispatch_flow(client, world):
    wid = await approved_workload(client, world)

    icd = await client.get("/api/v1/dispatch-icd")
    assert icd.status_code == 200
    assert icd.json()["icd_version"] == "1.0.0"

    authz_r = await client.post(
        f"/api/v1/workloads/{wid}/authorize-dispatch",
        json={"backend_id": "bk1"},
    )
    assert authz_r.status_code == 200, authz_r.text
    assert authz_r.json()["dispatch_state"] == "dispatch_authorized"
    attempt_id = authz_r.json()["attempt_id"]

    rec = await client.post(
        f"/api/v1/workloads/{wid}/dispatch-attempts",
        json={
            "backend_id": "bk1",
            "execution_class": "simulated",
            "external_job_id": "provider-job-42",
        },
    )
    assert rec.status_code == 200, rec.text
    assert rec.json()["dispatch_state"] == "dispatch_unresolved"

    listed = await client.get("/api/v1/dispatch-attempts")
    assert listed.status_code == 200
    assert any(i["attempt_id"] == attempt_id for i in listed.json()["items"])

    closed = await client.post(
        f"/api/v1/dispatch-attempts/{attempt_id}/reconcile",
        json={"outcome": "confirmed", "reason": "confirmed"},
    )
    assert closed.status_code == 200, closed.text
    assert closed.json()["dispatch_state"] == "dispatch_confirmed"

    jobs = await client.get("/api/v1/jobs?limit=10")
    assert jobs.status_code == 200
    assert any(j["job_id"] == "provider-job-42" for j in jobs.json()["items"])

    detail = await client.get("/api/v1/jobs/provider-job-42")
    assert detail.status_code == 200
    assert detail.json()["status"] == "COMPLETED"
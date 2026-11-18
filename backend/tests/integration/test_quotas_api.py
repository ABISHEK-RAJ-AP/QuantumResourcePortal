"""Quota ledger and evaluate — DB-backed, no lab stub."""

from __future__ import annotations

import pytest

from qre.core.ids import new_ulid

pytestmark = pytest.mark.db

ADMIN_PW = "Admin-Strong-Pw-2026"
RESEARCHER_PW = "Research-Strong-Pw-9"


async def login(client, username, password):
    r = await client.post("/api/v1/auth/login", json={"username": username, "password": password})
    assert r.status_code == 200, r.text
    client.headers["X-CSRF-Token"] = r.json()["csrf_token"]
    return r


@pytest.fixture
async def world(client, migrated_db):
    """Reuse governance world via inline bootstrap — import from test_governance if needed."""
    from dataclasses import dataclass

    from sqlalchemy import text
    from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

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
            c, tenant_code=code, tenant_name="QuotaTest", admin_username=admin_u, password=ADMIN_PW
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
        return World(tid, admin_u, rs_u, pid)

    async with eng.begin() as aconn:
        w = await aconn.run_sync(build)
    try:
        yield w
    finally:
        await eng.dispose()


async def test_ledger_empty_and_evaluate(client, world):
    await login(client, world.admin_username, ADMIN_PW)
    led = await client.get("/api/v1/quotas/ledger?window=today")
    assert led.status_code == 200, led.text
    body = led.json()
    assert body["daily_shots_cap"] >= 1
    assert body["used_shots"] == 0
    assert body["remaining_shots"] == body["daily_shots_cap"]
    assert "demo" not in body
    assert body["entries"] == []


async def test_ledger_after_approval(client, world):
    await login(client, world.researcher_username, RESEARCHER_PW)
    draft = await client.post(
        "/api/v1/workload-submissions",
        json={"project_id": world.project_id, "metadata": {"purpose": "Bell", "shots": 50}},
    )
    assert draft.status_code == 201
    sid = draft.json()["submission_id"]
    sub = await client.post(f"/api/v1/workload-submissions/{sid}/submit-for-review")
    wid = sub.json()["workload_id"]

    await login(client, world.admin_username, ADMIN_PW)
    eval_r = await client.get(f"/api/v1/quotas/evaluate?workload_id={wid}")
    assert eval_r.status_code == 200, eval_r.text
    assert eval_r.json()["requested_shots"] == 50
    assert eval_r.json()["allowed"] is True

    for stage in ("technical", "policy", "quota"):
        decided = await client.post(
            f"/api/v1/approvals/{wid}/decide",
            json={"decision": "approve", "comment": "ok", "expected_stage_id": stage},
        )
        assert decided.status_code == 200, decided.text

    led = await client.get(f"/api/v1/quotas/ledger?window=today&project_id={world.project_id}")
    assert led.status_code == 200
    assert led.json()["used_shots"] == 50
    assert len(led.json()["entries"]) == 1
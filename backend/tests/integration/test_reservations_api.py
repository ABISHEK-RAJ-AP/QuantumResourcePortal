"""Reservations API — holds list, create, transition, overlap conflicts."""

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
            c, tenant_code=code, tenant_name="ResvTest", admin_username=admin_u, password=ADMIN_PW, password_min_len=LAB_PASSWORD_MIN_LEN
        )
        tid = res.tenant_id
        pid = new_ulid()
        c.execute(
            text("INSERT INTO project (project_id, tenant_id, code, name) VALUES (:p,:t,:c,'Hold project')"),
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

    async with engine.begin() as aconn:
        return await aconn.run_sync(build)


async def session_client(client, username, password):
    r = await client.post("/api/v1/auth/login", json={"username": username, "password": password})
    assert r.status_code == 200, r.text
    client.headers["X-CSRF-Token"] = r.json()["csrf_token"]
    return client


def _hold_body(project_id: str, *, offset_hours: int = 0) -> dict:
    start = f"2026-12-01T{10 + offset_hours:02d}:00:00+00:00"
    end = f"2026-12-01T{14 + offset_hours:02d}:00:00+00:00"
    return {
        "resource_ref": "ibm:torino",
        "project_id": project_id,
        "window_start": start,
        "window_end": end,
        "purpose": "Benchmark window",
    }


async def test_researcher_creates_lists_and_transitions(client, world):
    await session_client(client, world.researcher_username, RESEARCHER_PW)
    created = await client.post("/api/v1/reservations", json=_hold_body(world.project_id))
    assert created.status_code == 201, created.text
    row = created.json()
    assert row["state"] == "requested"
    assert row["resource_ref"] == "ibm:torino"
    rid = row["reservation_id"]

    listed = await client.get(f"/api/v1/reservations?project_id={world.project_id}")
    assert listed.status_code == 200, listed.text
    body = listed.json()
    assert "transitions" in body
    assert body["transitions"]["requested"] == ["active", "cancelled"]
    ids = {i["reservation_id"] for i in body["items"]}
    assert rid in ids

    active = await client.post(
        f"/api/v1/reservations/{rid}/transition",
        json={"state": "active"},
    )
    assert active.status_code == 200, active.text
    assert active.json()["state"] == "active"


async def test_overlap_sets_conflict_count(client, world):
    await session_client(client, world.researcher_username, RESEARCHER_PW)
    a = await client.post("/api/v1/reservations", json=_hold_body(world.project_id))
    assert a.status_code == 201
    b = await client.post(
        "/api/v1/reservations",
        json=_hold_body(world.project_id, offset_hours=1),
    )
    assert b.status_code == 201
    listed = await client.get(f"/api/v1/reservations?project_id={world.project_id}")
    body = listed.json()
    assert body["conflict_count"] >= 2
    conflicted = [i for i in body["items"] if i.get("has_conflict")]
    assert len(conflicted) >= 2


async def test_admin_tenant_wide_hold(client, world):
    await session_client(client, world.admin_username, ADMIN_PW)
    created = await client.post(
        "/api/v1/reservations",
        json={
            "resource_ref": "pilot:rack-a",
            "window_start": "2026-12-02T08:00:00+00:00",
            "window_end": "2026-12-02T12:00:00+00:00",
            "purpose": "Maintenance freeze",
        },
    )
    assert created.status_code == 201, created.text
    assert created.json()["project_id"] is None
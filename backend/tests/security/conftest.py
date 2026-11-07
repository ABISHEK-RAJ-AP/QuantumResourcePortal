"""Fixtures for the RBAC-8 security suite.

Builds a tenant A (PLATFORM_ADMIN + a project-scoped RESEARCHER with known passwords) and a separate
tenant B holding a custom role — enough to exercise the threat model (S-1, S-4, S-10, S-11, S-12) over
the real login/session/CSRF path. Reuses the top-level ``migrated_db``/``settings``/``client``.
"""
from __future__ import annotations

from dataclasses import dataclass

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

from qre.core.ids import new_ulid
from qre.core.security import hash_password
from qre.services.svc02_identity.bootstrap import bootstrap_admin

ADMIN_PW = "Admin-Password-12345"
RESEARCHER_PW = "Researcher-Password-123"


@dataclass
class World:
    tenant_id: str
    admin_username: str
    researcher_username: str
    project_id: str
    # tenant B — a different tenant whose custom role must be invisible to tenant A (S-4).
    other_tenant_id: str
    other_role_id: str


@pytest.fixture
async def engine(migrated_db: str) -> AsyncEngine:
    eng = create_async_engine(migrated_db)
    try:
        yield eng
    finally:
        await eng.dispose()


@pytest.fixture
async def world(engine: AsyncEngine) -> World:
    code = f"S{new_ulid()[-8:]}"
    admin_u = f"admin_{code.lower()}"
    rs_u = f"rs_{code.lower()}"
    other_code = f"O{new_ulid()[-8:]}"

    def build(c):
        res = bootstrap_admin(c, tenant_code=code, tenant_name="Sec", admin_username=admin_u, password=ADMIN_PW)
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
        # tenant B with a tenant-scoped custom role (must be 404 to tenant A).
        other = bootstrap_admin(
            c, tenant_code=other_code, tenant_name="Other", admin_username=f"admin_{other_code.lower()}", password=ADMIN_PW
        )
        other_role_id = new_ulid()
        c.execute(
            text("INSERT INTO role (role_id, tenant_id, code, name, description, assignable_scope, is_system, status, row_version) "
                 "VALUES (:r,:t,'CUSTOM_B','Custom B','','TENANT', false, 'ACTIVE', 1)"),
            {"r": other_role_id, "t": other.tenant_id},
        )
        return World(tid, admin_u, rs_u, pid, other.tenant_id, other_role_id)

    async with engine.begin() as aconn:
        return await aconn.run_sync(build)


async def login(client, username, password=ADMIN_PW):
    r = await client.post("/api/v1/auth/login", json={"username": username, "password": password})
    assert r.status_code == 200, r.text
    return r.json()["csrf_token"]

"""Demo seed loader against real PostgreSQL."""

from __future__ import annotations

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from qre.core.ids import new_ulid
from qre.core.security import hash_password
from qre.seed.seed_demo import seed_demo, seed_demo_reset
from qre.seed.validate import validate_demo_seed
from qre.services.svc02_identity.bootstrap import bootstrap_admin

pytestmark = pytest.mark.db

ADMIN_PW = "Admin-Strong-Pw-2026"


@pytest.fixture
async def seeded_tenant(migrated_db: str):
    code = f"DEMO{new_ulid()[-6:]}"
    eng = create_async_engine(migrated_db)

    def build(c):
        res = bootstrap_admin(
            c,
            tenant_code=code,
            tenant_name="Seed test",
            admin_username=f"admin_{code.lower()}",
            password=ADMIN_PW,
        )
        return res.tenant_id, code

    async with eng.begin() as aconn:
        tenant_id, tenant_code = await aconn.run_sync(build)
    try:
        yield tenant_id, tenant_code, eng
    finally:
        await eng.dispose()


async def test_seed_demo_populates_and_validates(seeded_tenant):
    tenant_id, tenant_code, eng = seeded_tenant
    async with eng.begin() as aconn:
        result = await aconn.run_sync(lambda c: seed_demo(c, tenant_code=tenant_code))
    assert result.created is True
    assert result.counts["projects"] >= 8

    async with eng.connect() as aconn:
        counts = await aconn.run_sync(lambda c: validate_demo_seed(c, tenant_id))
    assert counts["workloads"] >= 20
    assert counts["jobs"] >= 30

    async with eng.begin() as aconn:
        again = await aconn.run_sync(lambda c: seed_demo(c, tenant_code=tenant_code))
    assert again.created is False

    async with eng.begin() as aconn:
        await aconn.run_sync(lambda c: seed_demo_reset(c, tenant_code=tenant_code))

    async with eng.connect() as aconn:
        n = await aconn.run_sync(
            lambda c: c.execute(
                text("SELECT count(*) FROM project WHERE tenant_id = :t AND code LIKE 'DEMO-PRJ-%'"),
                {"t": tenant_id},
            ).scalar()
        )
    assert int(n or 0) == 0
"""Operations centre, governance activity, meter rollups."""

from __future__ import annotations

import pytest
from tests._credentials import ADMIN_PW, LAB_PASSWORD_MIN_LEN

from qre.core.ids import new_ulid
from qre.core.security import hash_password
from qre.services.svc02_identity.bootstrap import bootstrap_admin

pytestmark = pytest.mark.db



async def test_centre_activity_metering(client, migrated_db):
    admin_u = "admin_ops"
    async def setup(conn):
        return bootstrap_admin(
            conn,
            tenant_code="OPSTEST",
            tenant_name="OpsTest",
            admin_username=admin_u,
            password=ADMIN_PW, password_min_len=LAB_PASSWORD_MIN_LEN,
        )

    from sqlalchemy.ext.asyncio import create_async_engine

    eng = create_async_engine(migrated_db)
    async with eng.begin() as aconn:
        await aconn.run_sync(setup)
    await eng.dispose()

    login = await client.post("/api/v1/auth/login", json={"username": admin_u, "password": ADMIN_PW})
    assert login.status_code == 200, login.text
    client.headers["X-CSRF-Token"] = login.json()["csrf_token"]

    centre = await client.get("/api/v1/operations/centre")
    assert centre.status_code == 200, centre.text
    body = centre.json()
    assert "demo" not in body
    assert body["operations"]["open_incidents"] == 0
    assert "fleet" in body

    activity = await client.get("/api/v1/governance/activity?limit=5")
    assert activity.status_code == 200
    assert "items" in activity.json()

    meter = await client.get("/api/v1/meter-rollups?hours=24")
    assert meter.status_code == 200, meter.text
    assert meter.json()["window_hours"] == 24

    export = await client.get("/api/v1/meter-rollups/export?hours=24")
    assert export.status_code == 200
    assert "dimension" in export.text

    boundary = await client.get("/api/v1/governance/institution-boundary")
    assert boundary.status_code == 200, boundary.text
    body = boundary.json()
    assert body["tenant_code"] == "OPSTEST"
    assert body["federation"]["mode"] == "single_site"
    assert body["federation"]["peer_sites_reporting"] == 0
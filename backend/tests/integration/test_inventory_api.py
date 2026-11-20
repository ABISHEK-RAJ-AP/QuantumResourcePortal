"""Inventory assets — list, register, lifecycle FSM."""

from __future__ import annotations

import pytest
from qre.services.svc02_identity.bootstrap import bootstrap_admin
from tests._credentials import ADMIN_PW, LAB_PASSWORD_MIN_LEN

pytestmark = pytest.mark.db



async def test_admin_registers_lists_and_lifecycle(client, migrated_db):
    code = "INVTEST01"
    admin_u = "admin_inv"
    res = None

    async def setup(conn):
        nonlocal res
        res = bootstrap_admin(
            conn,
            tenant_code=code,
            tenant_name="InvTest",
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

    created = await client.post(
        "/api/v1/inventory/assets",
        json={
            "provider_id": "ibm_quantum",
            "native_asset_id": "ibm_torino_1",
            "asset_class": "QPU",
            "execution_class": "hardware",
        },
    )
    assert created.status_code == 201, created.text
    row = created.json()
    assert row["lifecycle_state"] == "registered"
    assert row["allowed_transitions"] == ["active", "retired"]
    aid = row["asset_id"]

    listed = await client.get("/api/v1/inventory/assets")
    assert listed.status_code == 200, listed.text
    ids = {i["asset_id"] for i in listed.json()["items"]}
    assert aid in ids

    detail = await client.get(f"/api/v1/inventory/assets/{aid}")
    assert detail.status_code == 200, detail.text

    active = await client.post(
        f"/api/v1/inventory/assets/{aid}/lifecycle",
        json={"lifecycle_state": "active"},
    )
    assert active.status_code == 200, active.text
    assert active.json()["lifecycle_state"] == "active"

    summary = await client.get("/api/v1/governance/summary")
    assert summary.status_code == 200, summary.text
    assert summary.json()["inventory_assets"] >= 1

    bad = await client.post(
        f"/api/v1/inventory/assets/{aid}/lifecycle",
        json={"lifecycle_state": "registered"},
    )
    assert bad.status_code == 409, bad.text
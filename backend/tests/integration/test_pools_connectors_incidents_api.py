"""Virtual pools, connectors board, incidents list."""

from __future__ import annotations

import pytest
from tests._credentials import ADMIN_PW, LAB_PASSWORD_MIN_LEN

from qre.services.svc02_identity.bootstrap import bootstrap_admin

pytestmark = pytest.mark.db



async def test_pools_connectors_incidents(client, migrated_db):
    def setup(conn):
        return bootstrap_admin(
            conn,
            tenant_code="PCI01",
            tenant_name="PCITest",
            admin_username="admin_pci",
            password=ADMIN_PW, password_min_len=LAB_PASSWORD_MIN_LEN,
        )

    from sqlalchemy import text
    from sqlalchemy.ext.asyncio import create_async_engine

    eng = create_async_engine(migrated_db)
    async with eng.begin() as aconn:
        res = await aconn.run_sync(setup)
        await aconn.execute(
            text(
                """
                INSERT INTO catalogue_provider (
                    tenant_id, provider_id, provider_name, status, integration, created_by
                ) VALUES (
                    :t, 'prov1', 'Provider 1', 'draft', '{"stage":"I1"}', :u
                )
                """
            ),
            {"t": res.tenant_id, "u": res.user_id},
        )
    await eng.dispose()

    login = await client.post(
        "/api/v1/auth/login", json={"username": "admin_pci", "password": ADMIN_PW}
    )
    assert login.status_code == 200, login.text
    client.headers["X-CSRF-Token"] = login.json()["csrf_token"]

    pool = await client.post("/api/v1/virtual-pools", json={"name": "Sim pool"})
    assert pool.status_code == 201, pool.text
    pid = pool.json()["pool_id"]

    listed = await client.get("/api/v1/virtual-pools")
    assert listed.status_code == 200
    assert any(p["pool_id"] == pid for p in listed.json()["items"])

    detail = await client.get(f"/api/v1/virtual-pools/{pid}")
    assert detail.status_code == 200
    assert detail.json()["members"] == []

    conn = await client.get("/api/v1/connectors")
    assert conn.status_code == 200, conn.text
    assert conn.json()["legend"]["I1"]
    assert len(conn.json()["items"]) >= 1

    backend = await client.post(
        "/api/v1/backends",
        json={
            "backend_id": "bk-test",
            "provider_id": "prov1",
            "backend_name": "Test QPU",
            "operational_status": "ONLINE",
            "qubit_count": 5,
        },
    )
    assert backend.status_code == 201, backend.text

    incidents = await client.get("/api/v1/incidents?limit=10")
    assert incidents.status_code == 200
    assert incidents.json()["items"] == []
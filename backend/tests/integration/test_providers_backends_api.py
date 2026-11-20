"""Providers catalogue, onboarding, backends, and queue snapshots."""

from __future__ import annotations

import json
from tests._credentials import ADMIN_PW, LAB_PASSWORD_MIN_LEN

import pytest
from qre.services.svc02_identity.bootstrap import bootstrap_admin

pytestmark = pytest.mark.db



async def test_provider_onboarding_backend_queues(client, migrated_db):
    admin_u = "admin_prv"
    res = None

    async def setup(conn):
        nonlocal res
        res = bootstrap_admin(
            conn,
            tenant_code="PRVTEST",
            tenant_name="ProviderTest",
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
        "/api/v1/providers",
        json={"provider_id": "ibm_quantum", "provider_name": "IBM Quantum"},
    )
    assert created.status_code == 201, created.text
    assert created.json()["status"] == "draft"

    listed = await client.get("/api/v1/providers")
    assert listed.status_code == 200
    assert any(i["provider_id"] == "ibm_quantum" for i in listed.json()["items"])

    onboard = await client.post(
        "/api/v1/providers/ibm_quantum/onboarding",
        json={"operations": ["observe", "submit"], "execution_classes": ["hardware"]},
    )
    assert onboard.status_code == 200, onboard.text
    integ = onboard.json()["integration"]
    assert integ["manifest_registered"] is True
    assert integ["stage"] == "I2"

    active = await client.post(
        "/api/v1/providers/ibm_quantum/transition",
        json={"status": "active"},
    )
    assert active.status_code == 200, active.text
    assert active.json()["status"] == "active"

    from sqlalchemy import text

    # No POST /backends yet — seed catalogue row for read-model tests.
    async with eng.begin() as aconn:

        def raw_insert(c):
            topo = json.dumps(
                {
                    "nodes": [{"id": "q0", "health_status": "healthy"}],
                    "edges": [],
                }
            )
            c.execute(
                text(
                    """
                    INSERT INTO catalogue_backend (
                        tenant_id, backend_id, provider_id, backend_name,
                        operational_status, qubit_count, qpu_modality, topology_type, topology
                    ) VALUES (
                        :t, 'torino', 'ibm_quantum', 'IBM Torino', 'ONLINE',
                        133, 'superconducting', 'heavy-hex', CAST(:topo AS JSONB)
                    )
                    """
                ),
                {"t": res.tenant_id, "topo": topo},
            )

        await aconn.run_sync(raw_insert)
    await eng.dispose()

    backends = await client.get("/api/v1/backends")
    assert backends.status_code == 200, backends.text
    assert any(b["backend_id"] == "torino" for b in backends.json()["items"])

    topo = await client.get("/api/v1/backends/torino/topology")
    assert topo.status_code == 200, topo.text
    assert topo.json()["node_count"] == 1

    queues = await client.get("/api/v1/queues")
    assert queues.status_code == 200
    qrow = next(i for i in queues.json()["items"] if i["backend_id"] == "torino")
    assert qrow["pending_jobs"] == 0
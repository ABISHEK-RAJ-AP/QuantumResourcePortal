"""Governance audit-events and alerts summary."""

from __future__ import annotations

import pytest

from qre.services.svc02_identity.bootstrap import bootstrap_admin

pytestmark = pytest.mark.db

ADMIN_PW = "Admin-Strong-Pw-2026"


async def test_audit_events_and_alerts_empty(client, migrated_db):
    res = None

    def setup(conn):
        nonlocal res
        return bootstrap_admin(
            conn,
            tenant_code="AUDALT",
            tenant_name="AuditAlerts",
            admin_username="admin_aa",
            password=ADMIN_PW,
        )

    from sqlalchemy.ext.asyncio import create_async_engine

    eng = create_async_engine(migrated_db)
    async with eng.begin() as aconn:
        res = await aconn.run_sync(setup)
    await eng.dispose()

    login = await client.post(
        "/api/v1/auth/login", json={"username": "admin_aa", "password": ADMIN_PW}
    )
    assert login.status_code == 200, login.text
    client.headers["X-CSRF-Token"] = login.json()["csrf_token"]

    events = await client.get("/api/v1/governance/audit-events?limit=10")
    assert events.status_code == 200, events.text
    assert "items" in events.json()
    assert len(events.json()["items"]) >= 1

    user_events = await client.get("/api/v1/governance/audit-events?action_prefix=user")
    assert user_events.status_code == 200

    export = await client.get("/api/v1/governance/audit-events/export?limit=20")
    assert export.status_code == 200
    assert "timestamp" in export.text

    summary = await client.get("/api/v1/alerts/summary")
    assert summary.status_code == 200, summary.text
    assert summary.json()["active"] == 0
    assert "demo" not in summary.json()

    listed = await client.get("/api/v1/alerts?status=ACTIVE&limit=10")
    assert listed.status_code == 200
    assert listed.json()["items"] == []

    centre = await client.get("/api/v1/operations/centre")
    assert centre.status_code == 200
    assert centre.json()["operations"]["active_alerts"] == 0
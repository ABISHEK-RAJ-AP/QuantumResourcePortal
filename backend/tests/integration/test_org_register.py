"""Organization self-registration API (lab)."""

from __future__ import annotations

import pytest

from qre.core.ids import new_ulid

pytestmark = pytest.mark.db


@pytest.fixture
def no_captcha(client):
    client.app.state.settings.captcha_enabled = False  # type: ignore[attr-defined]
    return client


async def test_register_organization_creates_tenant(no_captcha, migrated_db: str):
    code = f"ORG{new_ulid()[-6]}"
    admin_u = f"adm_{code.lower()}"
    body = {
        "tenant_code": code,
        "tenant_name": "Acme Quantum Lab",
        "admin_username": admin_u,
        "admin_display_name": "Lab Admin",
        "email": f"{admin_u}@example.test",
        "password": "Strong-Enough-Pw-1",
        "confirm_password": "Strong-Enough-Pw-1",
        "org_kind": "startup",
    }
    r = await no_captcha.post("/api/v1/auth/register-organization", json=body)
    assert r.status_code == 201, r.text
    data = r.json()
    assert data["status"] == "ORG_REGISTERED"
    assert data["tenant_code"] == code
    assert data["admin_username"] == admin_u
    login = await no_captcha.post(
        "/api/v1/auth/login",
        json={"username": admin_u, "password": "Strong-Enough-Pw-1"},
    )
    assert login.status_code == 200
    me = await no_captcha.get("/api/v1/me")
    assert me.status_code == 200
    payload = me.json()
    assert payload["tenant_code"] == code
    assert payload["tenant_name"] == "Acme Quantum Lab"
    assert "PLATFORM_ADMIN" in payload["roles"]
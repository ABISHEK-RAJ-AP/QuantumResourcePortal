"""RBAC-8 security suite — the threat model (plan §9, S-1…S-12) exercised end-to-end over HTTP.

Anti-escalation (S-2), last-admin (S-7) and SoD (S-8) are covered in ``test_rbac_admin``/
``test_rbac_policies``; this module locks in the cross-cutting guarantees that are easiest to regress:
header-trust is dead (S-1), cross-tenant ids 404 (S-4), mass assignment is rejected (S-10), no route
ships unguarded (S-11), and the audit log verifies and is permission-gated (S-12).
"""
from __future__ import annotations

from qre.core.config import get_settings
from qre.gateway.app import assert_api_router_guarded, build_api_router

from .conftest import ADMIN_PW, RESEARCHER_PW, login


# --- S-11: deny-by-default, no unguarded route -------------------------------------------------
def test_s11_no_route_ships_unguarded():
    settings = get_settings()
    unguarded = assert_api_router_guarded(build_api_router(settings))
    assert unguarded == [], f"routes missing an auth dependency: {unguarded}"


# --- S-1: the retired X-User-Role header grants nothing ----------------------------------------
async def test_s1_role_header_is_ignored_unauthenticated(client):
    # No session + a forged role header → 401, never admin access.
    r = await client.get("/api/v1/admin/roles", headers={"X-User-Role": "PLATFORM_ADMIN"})
    assert r.status_code == 401


async def test_s1_role_header_cannot_elevate_a_session(client, world):
    # A researcher session lacks role:read; a forged header must not change that.
    await login(client, world.researcher_username, RESEARCHER_PW)
    r = await client.get("/api/v1/admin/roles", headers={"X-User-Role": "PLATFORM_ADMIN"})
    assert r.status_code == 403


# --- S-4: cross-tenant ids are 404 (no existence leak) -----------------------------------------
async def test_s4_cross_tenant_role_is_not_found(client, world):
    await login(client, world.admin_username, ADMIN_PW)
    # tenant A admin asking for tenant B's custom role → 404, not 403 (no existence disclosure).
    r = await client.get(f"/api/v1/admin/roles/{world.other_role_id}")
    assert r.status_code == 404


# --- S-10: mass assignment rejected (extra='forbid') -------------------------------------------
async def test_s10_unknown_fields_rejected(client, world):
    csrf = await login(client, world.admin_username, ADMIN_PW)
    r = await client.post(
        "/api/v1/admin/roles",
        headers={"X-CSRF-Token": csrf},
        json={
            "code": "CUSTOM_X",
            "name": "Custom X",
            "assignable_scope": "TENANT",
            "permission_codes": [],
            "is_system": True,  # forbidden: client must not set server-owned fields
        },
    )
    assert r.status_code == 400
    assert r.json()["code"] == "VALIDATION_FAILED"


# --- S-12: audit log verifies, exports, and is permission-gated --------------------------------
async def test_s12_audit_chain_verifies_after_activity(client, world):
    # Logging in wrote LOGIN_SUCCESS; the hash chain must verify intact.
    await login(client, world.admin_username, ADMIN_PW)
    v = await client.get("/api/v1/rbac/audit/verify")
    assert v.status_code == 200
    assert v.json()["intact"] is True

    listing = await client.get("/api/v1/rbac/audit")
    assert listing.status_code == 200
    assert listing.json()["total"] >= 1

    export = await client.get("/api/v1/rbac/audit/export")
    assert export.status_code == 200
    assert export.headers["content-type"].startswith("text/csv")
    assert "audit_id" in export.text.splitlines()[0]


async def test_s12_audit_verify_requires_permission(client, world):
    # A researcher lacks audit:verify → 403 (deny-by-default on the integrity endpoint).
    await login(client, world.researcher_username, RESEARCHER_PW)
    r = await client.get("/api/v1/rbac/audit/verify")
    assert r.status_code == 403

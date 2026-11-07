"""RBAC-7f: the QRP→TeleScope gateway proxy.

The SPA talks only to the QRP origin (cookie session + CSRF). Module paths are forwarded to TeleScope
with a service session minted via the shared secret, and the QRP role is mapped to a TeleScope role.
TeleScope itself is mocked here (``httpx.MockTransport``) so the test exercises the gateway, the role
mapping, session translation, and CSRF — without a second live server.
"""
from __future__ import annotations

import json
from dataclasses import dataclass

import httpx
import pytest
from httpx import ASGITransport, AsyncClient
from pydantic import SecretStr
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

from qre.core.ids import new_ulid
from qre.core.security import hash_password
from qre.gateway.app import create_app
from qre.services.svc02_identity.bootstrap import bootstrap_admin

ADMIN_PW = "Admin-Password-12345"
RESEARCHER_PW = "Researcher-Password-123"
SECRET = "gw-secret-123"


@dataclass
class World:
    tenant_id: str
    admin_username: str
    researcher_username: str


@pytest.fixture
async def engine(migrated_db: str) -> AsyncEngine:
    eng = create_async_engine(migrated_db)
    try:
        yield eng
    finally:
        await eng.dispose()


@pytest.fixture
async def world(engine: AsyncEngine) -> World:
    code = f"G{new_ulid()[-8:]}"
    admin_u = f"admin_{code.lower()}"
    rs_u = f"rs_{code.lower()}"

    def build(c):
        res = bootstrap_admin(c, tenant_code=code, tenant_name="Test", admin_username=admin_u, password=ADMIN_PW)
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
        return World(tid, admin_u, rs_u)

    async with engine.begin() as aconn:
        return await aconn.run_sync(build)


class _Recorder:
    def __init__(self):
        self.service_login_roles: list[str] = []
        self.forwarded: list[tuple[str, str]] = []
        self.bad_secret = False

    def handler(self, request: httpx.Request) -> httpx.Response:
        path = request.url.path
        if path.endswith("/auth/service-login"):
            if request.headers.get("X-QRE-Gateway-Secret") != SECRET:
                self.bad_secret = True
                return httpx.Response(403, json={"detail": "nope"})
            role = json.loads(request.content.decode())["role"]
            self.service_login_roles.append(role)
            return httpx.Response(200, json={"token": "qtok_fake", "role": role})
        # a forwarded module call — must carry the minted bearer, never a client header
        if request.headers.get("Authorization") != "Bearer qtok_fake":
            return httpx.Response(401, json={"detail": "no bearer"})
        self.forwarded.append((request.method, path))
        return httpx.Response(200, json={"echo": path, "method": request.method})


@pytest.fixture
async def proxy(settings, world):
    rec = _Recorder()
    cfg = settings.model_copy(update={"telescope_gateway_secret": SecretStr(SECRET)})
    app = create_app(cfg)
    async with app.router.lifespan_context(app):
        app.state.telescope_client = httpx.AsyncClient(transport=httpx.MockTransport(rec.handler))
        transport = ASGITransport(app=app, raise_app_exceptions=False)
        async with AsyncClient(transport=transport, base_url="http://testserver") as http:
            yield http, rec, world
        await app.state.telescope_client.aclose()


async def _login(http, username, password):
    r = await http.post("/api/v1/auth/login", json={"username": username, "password": password})
    assert r.status_code == 200, r.text
    return r.json()["csrf_token"]


async def test_module_get_is_forwarded_with_mapped_role(proxy):
    http, rec, world = proxy
    await _login(http, world.admin_username, ADMIN_PW)
    r = await http.get("/api/v1/inventory/assets")
    assert r.status_code == 200, r.text
    assert r.json()["echo"] == "/api/v1/inventory/assets"
    # PLATFORM_ADMIN maps to TeleScope PlatformAdmin, and the call was forwarded with the minted bearer.
    assert rec.service_login_roles == ["PlatformAdmin"]
    assert rec.forwarded == [("GET", "/api/v1/inventory/assets")]


async def test_role_mapping_for_researcher(proxy):
    http, rec, world = proxy
    await _login(http, world.researcher_username, RESEARCHER_PW)
    r = await http.get("/api/v1/approvals")
    assert r.status_code == 200, r.text
    assert rec.service_login_roles == ["Researcher"]


async def test_unauthenticated_module_call_is_401(proxy):
    http, rec, _ = proxy
    r = await http.get("/api/v1/inventory/assets")
    assert r.status_code == 401
    assert rec.forwarded == []  # never reached TeleScope


async def test_unsafe_method_requires_csrf(proxy):
    http, rec, world = proxy
    await _login(http, world.admin_username, ADMIN_PW)
    # No X-CSRF-Token → rejected by the QRP session layer before any forwarding.
    denied = await http.post("/api/v1/inventory/assets", json={"x": 1})
    assert denied.status_code == 403
    assert rec.forwarded == []


async def test_unsafe_method_forwarded_with_csrf(proxy):
    http, rec, world = proxy
    csrf = await _login(http, world.admin_username, ADMIN_PW)
    ok = await http.post("/api/v1/inventory/assets", json={"x": 1}, headers={"X-CSRF-Token": csrf})
    assert ok.status_code == 200, ok.text
    assert rec.forwarded == [("POST", "/api/v1/inventory/assets")]


async def test_native_routes_are_not_proxied(proxy):
    http, rec, world = proxy
    # /me is a native QRP route; it must be served locally, never forwarded.
    await _login(http, world.admin_username, ADMIN_PW)
    r = await http.get("/api/v1/me")
    assert r.status_code == 200
    assert r.json().get("authenticated") is True
    assert rec.forwarded == []

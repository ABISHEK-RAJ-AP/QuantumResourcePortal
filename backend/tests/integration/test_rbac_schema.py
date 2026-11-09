"""RBAC-3 schema, seed, triggers, audit chain and bootstrap — against a real PostgreSQL.

Runs on the migrated test database (the ``migrated_db`` fixture downgrades to base then upgrades
to head, re-running the seed). Each mutating check runs in its own transaction that is rolled back,
so tests do not pollute one another. Skipped with a clear message when no test database is reachable.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

import pytest
from sqlalchemy import inspect, text
from sqlalchemy.exc import DBAPIError, IntegrityError
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

from qre.core.ids import new_ulid
from qre.core.rbac_seed import load_catalogue, seed_catalogue
from qre.services.svc02_identity import models as idm
from qre.services.svc02_identity.bootstrap import BootstrapError, bootstrap_admin
from qre.services.svc17_audit import models as audm
from qre.services.svc17_audit.service import verify_chain, write_audit

pytestmark = pytest.mark.db


@pytest.fixture
async def engine(migrated_db: str) -> AsyncEngine:
    eng = create_async_engine(migrated_db)
    try:
        yield eng
    finally:
        await eng.dispose()


async def _rolled_back(engine: AsyncEngine, fn: Callable[[Any], Any]) -> Any:
    """Run a sync callable against a fresh connection and roll everything back."""
    async with engine.connect() as aconn:
        trans = await aconn.begin()
        try:
            return await aconn.run_sync(fn)
        finally:
            await trans.rollback()


async def _scalar(engine: AsyncEngine, sql: str, **params: Any) -> Any:
    async with engine.connect() as aconn:
        return (await aconn.execute(text(sql), params)).scalar()


# --------------------------------------------------------------------------- schema / drift

ALL_MODELS = [
    idm.Tenant, idm.AppUser, idm.UserCredential, idm.Session, idm.LoginAttempt,
    idm.ServiceIdentity, idm.ApiToken, idm.FederatedIdentity, idm.Project, idm.Provider,
    idm.Role, idm.Permission, idm.RolePermission, idm.RoleAssignment, audm.AuditLog,
]


async def test_every_model_table_and_column_exists(engine: AsyncEngine):
    """Guards against drift between the ORM models and the migration DDL."""
    def check(sync_conn):
        insp = inspect(sync_conn)
        existing = set(insp.get_table_names())
        problems = []
        for model in ALL_MODELS:
            t = model.__tablename__
            if t not in existing:
                problems.append(f"missing table {t}")
                continue
            db_cols = {c["name"] for c in insp.get_columns(t)}
            for col in model.__table__.columns:
                if col.name not in db_cols:
                    problems.append(f"{t}.{col.name} in model but not in DB")
        return problems

    problems = await _rolled_back(engine, check)
    assert not problems, problems


# --------------------------------------------------------------------------- seed

async def test_catalogue_seeded_counts(engine: AsyncEngine):
    cat = load_catalogue()
    n_perms = len(cat["permissions"])
    n_roles = len(cat["roles"])
    n_links = sum(len(r.get("permissions", [])) for r in cat["roles"].values())
    assert await _scalar(engine, "SELECT count(*) FROM permission") == n_perms
    assert await _scalar(engine, "SELECT count(*) FROM role WHERE is_system") == n_roles
    # Count only system-role links: other tests in the session may add custom roles.
    assert await _scalar(
        engine,
        "SELECT count(*) FROM role_permission rp JOIN role r ON r.role_id = rp.role_id "
        "WHERE r.is_system",
    ) == n_links


async def test_seed_is_idempotent(engine: AsyncEngine):
    counts = await _rolled_back(engine, lambda c: seed_catalogue(c))
    assert counts == {"permissions": 0, "roles": 0, "role_permissions": 0}


async def test_platform_admin_lacks_approval_decide(engine: AsyncEngine):
    holders = await _scalar(
        engine,
        """
        SELECT coalesce(string_agg(r.code, ','), '') FROM role_permission rp
        JOIN role r ON r.role_id = rp.role_id
        JOIN permission p ON p.permission_id = rp.permission_id
        WHERE p.code = 'approval:decide'
        """,
    )
    assert set(holders.split(",")) == {"PROJECT_OWNER", "QUOTA_APPROVER"}  # not PLATFORM_ADMIN


async def test_every_srs_appendix_b_role_holds_cited_permissions(engine: AsyncEngine):
    """The normative SRS matrix is realised in the seeded data, not only in the YAML."""
    cat = load_catalogue()
    missing = []
    for entry in cat["srs_appendix_b"]:
        for role in entry["roles"]:
            for code in entry["satisfied_by"]:
                held = await _scalar(
                    engine,
                    """
                    SELECT count(*) FROM role_permission rp
                    JOIN role r ON r.role_id = rp.role_id
                    JOIN permission p ON p.permission_id = rp.permission_id
                    WHERE r.code = :r AND p.code = :p
                    """,
                    r=role, p=code,
                )
                if not held:
                    missing.append(f"{role} lacks {code} for «{entry['cell']}»")
    assert not missing, missing


# --------------------------------------------------------------------------- constraints

async def test_duplicate_permission_code_rejected(engine: AsyncEngine):
    def insert_dupe(c):
        c.execute(text("SET LOCAL qre.seeding = 'on'"))
        c.execute(
            text(
                "INSERT INTO permission (permission_id, code, module, action, name) "
                "VALUES (:id, 'asset:read', 'inventory', 'read', 'dup')"
            ),
            {"id": new_ulid()},
        )

    with pytest.raises(IntegrityError):
        await _rolled_back(engine, insert_dupe)


async def test_duplicate_active_assignment_rejected_but_regrant_allowed(engine: AsyncEngine):
    def scenario(c):
        tid, uid = new_ulid(), new_ulid()
        c.execute(text("INSERT INTO tenant (tenant_id, code, name) VALUES (:t,'DUP','d')"), {"t": tid})
        c.execute(
            text(
                "INSERT INTO app_user (user_id, home_tenant_id, username, display_name) "
                "VALUES (:u,:t,:un,'U')"
            ),
            {"u": uid, "t": tid, "un": f"u_{uid[:8]}".lower()},
        )
        rid = c.execute(
            text("SELECT role_id FROM role WHERE code='PLATFORM_ADMIN' AND is_system")
        ).scalar()

        def grant(mid):
            c.execute(
                text(
                    "INSERT INTO role_assignment "
                    "(membership_id, tenant_id, principal_id, role, role_id, scope_type, granted_by) "
                    "VALUES (:m,:t,:u,'PLATFORM_ADMIN',:r,'TENANT',:u)"
                ),
                {"m": mid, "t": tid, "u": uid, "r": rid},
            )

        m1 = new_ulid()
        grant(m1)
        # second active grant for the same (principal, role, tenant scope) must fail
        dup_failed = False
        sp = c.begin_nested()
        try:
            grant(new_ulid())
        except Exception:
            dup_failed = True
            sp.rollback()
        else:
            sp.commit()
        # revoke the first, then a re-grant must succeed (R-17)
        c.execute(text("UPDATE role_assignment SET revoked_at = now() WHERE membership_id=:m"), {"m": m1})
        grant(new_ulid())
        return dup_failed

    assert await _rolled_back(engine, scenario) is True


# --------------------------------------------------------------------------- triggers

async def test_append_only_audit_blocks_update_and_delete(engine: AsyncEngine):
    def write_then_tamper(c):
        tid = new_ulid()
        c.execute(text("INSERT INTO tenant (tenant_id, code, name) VALUES (:t,'AUD','a')"), {"t": tid})
        write_audit(c, tenant_id=tid, action="TEST", actor_id=None, actor_type="SYSTEM")
        for stmt in ("UPDATE audit_log SET action='X' WHERE tenant_id=:t",
                     "DELETE FROM audit_log WHERE tenant_id=:t"):
            sp = c.begin_nested()
            raised = False
            try:
                c.execute(text(stmt), {"t": tid})
            except Exception:
                raised = True
                sp.rollback()
            assert raised, f"append-only did not block: {stmt}"

    await _rolled_back(engine, write_then_tamper)


async def test_audit_chain_verifies_and_masks_secrets(engine: AsyncEngine):
    def chain(c):
        tid = new_ulid()
        c.execute(text("INSERT INTO tenant (tenant_id, code, name) VALUES (:t,'CHN','c')"), {"t": tid})
        for i in range(3):
            write_audit(c, tenant_id=tid, action=f"E{i}", actor_id=None, actor_type="SYSTEM",
                        detail={"password": "secret", "ok": i})
        ok = verify_chain(c, tid)
        masked = c.execute(
            text("SELECT detail->>'password' FROM audit_log WHERE tenant_id=:t LIMIT 1"), {"t": tid}
        ).scalar()
        return ok, masked

    ok, masked = await _rolled_back(engine, chain)
    assert ok is True
    assert masked == "***"


async def test_system_role_delete_and_permission_change_blocked(engine: AsyncEngine):
    def attempt(c):
        results = {}
        for label, stmt in (
            ("delete_role", "DELETE FROM role WHERE code='AUDITOR' AND is_system"),
            ("strip_perm", "DELETE FROM role_permission WHERE role_id="
                           "(SELECT role_id FROM role WHERE code='AUDITOR')"),
        ):
            sp = c.begin_nested()
            try:
                c.execute(text(stmt))
                results[label] = False  # not blocked
                sp.rollback()
            except Exception:
                results[label] = True
                sp.rollback()
        return results

    res = await _rolled_back(engine, attempt)
    assert res == {"delete_role": True, "strip_perm": True}


async def test_custom_role_cannot_shadow_system_code(engine: AsyncEngine):
    def attempt(c):
        tid = new_ulid()
        c.execute(text("INSERT INTO tenant (tenant_id, code, name) VALUES (:t,'SHD','s')"), {"t": tid})
        c.execute(
            text(
                "INSERT INTO role (role_id, tenant_id, code, name, assignable_scope, is_system) "
                "VALUES (:r,:t,'AUDITOR','dup','TENANT',false)"
            ),
            {"r": new_ulid(), "t": tid},
        )

    with pytest.raises((DBAPIError, IntegrityError)):
        await _rolled_back(engine, attempt)


async def test_assignment_scope_must_match_role(engine: AsyncEngine):
    def attempt(c):
        tid, uid = new_ulid(), new_ulid()
        c.execute(text("INSERT INTO tenant (tenant_id, code, name) VALUES (:t,'SCP','s')"), {"t": tid})
        c.execute(
            text("INSERT INTO app_user (user_id, home_tenant_id, username, display_name) "
                 "VALUES (:u,:t,:un,'U')"),
            {"u": uid, "t": tid, "un": f"s_{uid[:8]}".lower()},
        )
        rid = c.execute(text("SELECT role_id FROM role WHERE code='PROJECT_OWNER'")).scalar()
        # PROJECT_OWNER is PROJECT-scoped; assigning at TENANT scope must be rejected.
        c.execute(
            text(
                "INSERT INTO role_assignment "
                "(membership_id, tenant_id, principal_id, role, role_id, scope_type, granted_by) "
                "VALUES (:m,:t,:u,'PROJECT_OWNER',:r,'TENANT',:u)"
            ),
            {"m": new_ulid(), "t": tid, "u": uid, "r": rid},
        )

    with pytest.raises((DBAPIError, IntegrityError)):
        await _rolled_back(engine, attempt)


# --------------------------------------------------------------------------- bootstrap

async def test_bootstrap_creates_admin_then_refuses_second(engine: AsyncEngine):
    def scenario(c):
        code = f"T{new_ulid()[:6]}"
        r = bootstrap_admin(
            c, tenant_code=code, tenant_name="Test", admin_username=f"adm{code.lower()}",
            password="Strong-Enough-Pw-1",
        )
        assert r.created_tenant is True
        # a PLATFORM_ADMIN assignment now exists for the tenant
        n = c.execute(
            text("SELECT count(*) FROM role_assignment WHERE tenant_id=:t AND role='PLATFORM_ADMIN'"),
            {"t": r.tenant_id},
        ).scalar()
        assert n == 1
        # the credential is an argon2id hash, not the plaintext
        h = c.execute(
            text("SELECT password_hash FROM user_credential WHERE user_id=:u"), {"u": r.user_id}
        ).scalar()
        assert h.startswith("$argon2id$")
        # a second admin is refused
        with pytest.raises(BootstrapError):
            bootstrap_admin(
                c, tenant_code=code, tenant_name="Test", admin_username="adm2",
                password="Another-Strong-Pw-9",
            )
        return True

    assert await _rolled_back(engine, scenario) is True


async def test_bootstrap_rejects_weak_password(engine: AsyncEngine):
    def scenario(c):
        with pytest.raises(BootstrapError):
            bootstrap_admin(c, tenant_code="WEAK", tenant_name="w", admin_username="weakadmin",
                            password="short")

    await _rolled_back(engine, scenario)

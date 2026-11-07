"""Authorizer decision tests — pure, no database. Driven by permissions.yaml so the matrix and the
runtime engine cannot diverge (LLD §11.2, plan §5.2)."""

from __future__ import annotations

import pytest

from qre.core import authz
from qre.core.context import Grant, ResourceRef, TenantContext
from qre.core.errors import Forbidden, ResourceNotFound
from qre.core.rbac_seed import load_catalogue

CAT = load_catalogue()
ROLES = CAT["roles"]
ALL_CODES = sorted(p["code"] for p in CAT["permissions"])
SCOPE_ID = {"TENANT": None, "PROJECT": "P1", "PROVIDER": "V1"}


def ctx_for(role_code: str, tenant_id: str = "T1") -> TenantContext:
    role = ROLES[role_code]
    scope = role["assignable_scope"]
    grants = frozenset(
        Grant(permission=p, scope_type=scope, scope_id=SCOPE_ID[scope])
        for p in role["permissions"]
    )
    return TenantContext(
        tenant_id=tenant_id, principal_id="U1", principal_type="USER",
        correlation_id="-", grants=grants, membership_version=1,
    )


@pytest.mark.parametrize("role_code", [r for r in ROLES if ROLES[r]["permissions"]])
def test_role_has_exactly_its_catalogue_permissions(role_code: str):
    ctx = ctx_for(role_code)
    held = set(ROLES[role_code]["permissions"])
    a = authz.get()
    for code in ALL_CODES:
        assert a.has_permission(ctx, code) is (code in held), f"{role_code}/{code}"


def test_platform_admin_denied_approval_decide():
    assert authz.get().has_permission(ctx_for("PLATFORM_ADMIN"), "approval:decide") is False


def test_cross_tenant_resource_is_not_found_not_forbidden():
    ctx = ctx_for("PLATFORM_ADMIN", tenant_id="T1")
    with pytest.raises(ResourceNotFound):
        authz.get().require(ctx, "asset:read", ResourceRef.tenant("T2"))


def test_project_scope_narrows_to_assigned_project():
    ctx = ctx_for("RESEARCHER")  # PROJECT-scoped, scope_id P1
    a = authz.get()
    a.require(ctx, "workload:read", ResourceRef.project("T1", "P1"))  # ok
    with pytest.raises(Forbidden):
        a.require(ctx, "workload:read", ResourceRef.project("T1", "P2"))


def test_tenant_level_action_requires_tenant_scope():
    a = authz.get()
    a.require(ctx_for("PLATFORM_ADMIN"), "role:read")  # tenant grant → ok
    # RESEARCHER holds governance:read only at project scope, so a no-resource (tenant) check fails.
    with pytest.raises(Forbidden):
        a.require(ctx_for("RESEARCHER"), "governance:read")


def test_provider_admin_scoped_to_its_provider():
    ctx = ctx_for("PROVIDER_ADMIN")
    a = authz.get()
    a.require(ctx, "provider:manifest:write", ResourceRef.provider("T1", "V1"))
    with pytest.raises(Forbidden):
        a.require(ctx, "provider:manifest:write", ResourceRef.provider("T1", "V2"))


def test_unknown_permission_is_programming_error():
    with pytest.raises(ValueError):
        authz.get().has_permission(ctx_for("AUDITOR"), "not:a:permission")


def test_navigation_reflects_permissions():
    a = authz.get()
    researcher_nav = {i["route"] for i in a.visible_modules(ctx_for("RESEARCHER"))}
    admin_nav = {i["route"] for i in a.visible_modules(ctx_for("PLATFORM_ADMIN"))}
    # TC-SHL-002: a Researcher does not see the approvals module.
    assert "/qrp/approvals" not in researcher_nav
    assert "/qrp/approvals" in admin_nav
    # Everyone sees authenticated-only items.
    assert "/qrp/notifications" in researcher_nav


def test_auditor_is_read_only_everywhere_but_cannot_write():
    ctx = ctx_for("AUDITOR")
    a = authz.get()
    assert a.has_permission(ctx, "audit:read")
    assert a.has_permission(ctx, "asset:read")
    assert not a.has_permission(ctx, "asset:create")
    assert not a.has_permission(ctx, "approval:decide")

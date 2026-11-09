"""Unit tests for the pure role-administration policies (plan §9: anti-escalation, last admin)."""

from __future__ import annotations

from qre.core.context import Grant, TenantContext
from qre.services.svc02_identity import policies


def ctx_with(*grants: tuple[str, str, str | None]) -> TenantContext:
    return TenantContext(
        tenant_id="T1", principal_id="U1", principal_type="USER", correlation_id="-",
        grants=frozenset(Grant(p, st, sid) for p, st, sid in grants), membership_version=1,
    )


TENANT_ADMIN = ctx_with(("membership:admin", "TENANT", None))
PROJECT_ADMIN = ctx_with(("membership:admin", "PROJECT", "P1"))


def test_tenant_admin_may_grant_tenant_role():
    assert policies.can_grant_role(
        policies.actor_admin_scope(TENANT_ADMIN), role_code="QUOTA_APPROVER", role_scope="TENANT",
        is_system=True, role_is_privileged=False, target_scope_type="TENANT", target_scope_id=None,
    ) is None


def test_project_admin_cannot_grant_tenant_role():
    reason = policies.can_grant_role(
        policies.actor_admin_scope(PROJECT_ADMIN), role_code="QUOTA_APPROVER", role_scope="TENANT",
        is_system=True, role_is_privileged=False, target_scope_type="TENANT", target_scope_id=None,
    )
    assert reason and "tenant administrator" in reason


def test_project_admin_cannot_grant_platform_admin():
    reason = policies.can_grant_role(
        policies.actor_admin_scope(PROJECT_ADMIN), role_code="PLATFORM_ADMIN", role_scope="TENANT",
        is_system=True, role_is_privileged=True, target_scope_type="TENANT", target_scope_id=None,
    )
    assert reason is not None


def test_project_admin_may_grant_project_role_in_own_project_only():
    scope = policies.actor_admin_scope(PROJECT_ADMIN)
    assert policies.can_grant_role(
        scope, role_code="RESEARCHER", role_scope="PROJECT", is_system=True,
        role_is_privileged=False, target_scope_type="PROJECT", target_scope_id="P1",
    ) is None
    assert policies.can_grant_role(
        scope, role_code="RESEARCHER", role_scope="PROJECT", is_system=True,
        role_is_privileged=False, target_scope_type="PROJECT", target_scope_id="P2",
    ) is not None


def test_privileged_custom_role_needs_tenant_admin():
    reason = policies.can_grant_role(
        policies.actor_admin_scope(PROJECT_ADMIN), role_code="CUSTOM", role_scope="PROJECT",
        is_system=False, role_is_privileged=True, target_scope_type="PROJECT", target_scope_id="P1",
    )
    assert reason is not None


def test_scope_mismatch_is_rejected():
    reason = policies.can_grant_role(
        policies.actor_admin_scope(TENANT_ADMIN), role_code="RESEARCHER", role_scope="PROJECT",
        is_system=True, role_is_privileged=False, target_scope_type="TENANT", target_scope_id=None,
    )
    assert reason and "PROJECT scope" in reason


def test_last_admin_guard():
    assert policies.last_admin_guard(1, removing_an_admin=True) is not None
    assert policies.last_admin_guard(2, removing_an_admin=True) is None
    assert policies.last_admin_guard(1, removing_an_admin=False) is None


def test_revoke_authority_mirrors_grant():
    assert policies.can_revoke_assignment(
        policies.actor_admin_scope(PROJECT_ADMIN), assignment_role="PLATFORM_ADMIN",
        assignment_scope_type="TENANT", assignment_scope_id=None,
    ) is not None
    assert policies.can_revoke_assignment(
        policies.actor_admin_scope(TENANT_ADMIN), assignment_role="PLATFORM_ADMIN",
        assignment_scope_type="TENANT", assignment_scope_id=None,
    ) is None

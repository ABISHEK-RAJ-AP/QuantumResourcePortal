"""Authorizer and permission catalogue (LLD §4.1, §11.2). Deny by default.

The catalogue is loaded once from permissions.yaml (the same file RBAC-2 validated and RBAC-3
seeded), so the running Authorizer and the database agree. The decision rule is
RBAC_IMPLEMENTATION_PLAN.md §5.2: a grant covers a resource when it is held at TENANT scope, or at
the PROJECT/PROVIDER scope that matches the resource; a cross-tenant resource id returns 404, never
403 (REQ-009, LLD §11.4).
"""

from __future__ import annotations

from functools import lru_cache

from qre.core.context import ResourceRef, TenantContext
from qre.core.errors import Forbidden, ResourceNotFound
from qre.core.rbac_seed import load_catalogue


class PermissionCatalogue:
    """The set of valid permission codes and the server-derived navigation registry (REQ-002)."""

    def __init__(self) -> None:
        data = load_catalogue()
        self.codes: frozenset[str] = frozenset(p["code"] for p in data["permissions"])
        self.modules: dict[str, dict] = data["modules"]
        self.privileged: frozenset[str] = frozenset(
            p["code"] for p in data["permissions"] if p.get("privileged")
        )

    def validate(self, permission: str) -> None:
        if permission not in self.codes:
            # A permission not in the catalogue is a programming error, caught by tests.
            raise ValueError(f"Unknown permission code: {permission!r}")


@lru_cache
def catalogue() -> PermissionCatalogue:
    return PermissionCatalogue()


# Server-derived navigation (REQ-002, repo nav map). Each item is shown only when the principal
# holds its permission in any scope; the backend also enforces every action independently.
NAV_REGISTRY: tuple[tuple[str, str, str | None], ...] = (
    # (label, route, required_permission or None = authenticated)
    ("Governance Dashboard", "/qrp", "governance:read"),
    ("Resource Inventory", "/qrp/inventory", "asset:read"),
    ("Import Assets", "/qrp/inventory/import", "asset:import"),
    ("Providers", "/qrp/providers", "provider:read"),
    ("Provider Onboarding", "/qrp/providers/onboarding", "provider:manifest:write"),
    ("Procurement", "/qrp/procurement", "procurement:read"),
    ("Entitlements", "/qrp/entitlements", "entitlement:read"),
    ("Approval Requests", "/qrp/approvals", "approval:read"),
    ("Quotas", "/qrp/quotas", "quota:read"),
    ("Policies", "/qrp/policies", "policy:read"),
    ("Scheduling", "/qrp/scheduling", "reservation:read"),
    ("Reservations", "/qrp/reservations", "reservation:read"),
    ("Usage Metering", "/qrp/metering", "usage:read"),
    ("SLA Management", "/qrp/sla", "sla:read"),
    ("Support & Incidents", "/qrp/support", "ticket:read"),
    ("Reconciliation", "/qrp/reconciliation", "dispatch:reconcile"),
    ("Audit Logs", "/qrp/audit", "audit:read"),
    ("Notifications", "/qrp/notifications", None),
    ("User Management", "/qrp/admin/users", "membership:read"),
    ("Roles", "/qrp/admin/roles", "role:read"),
    ("Settings", "/qrp/settings", None),
)


class Authorizer:
    """Pure decision functions over a TenantContext. No I/O or mutation (singleton, :func:`get`)."""

    def __init__(self, cat: PermissionCatalogue) -> None:
        self.catalogue = cat

    def has_permission(self, ctx: TenantContext, permission: str) -> bool:
        """True when the principal holds *permission* in any scope (navigation and coarse gates)."""
        self.catalogue.validate(permission)
        return any(g.permission == permission for g in ctx.grants)

    def can(self, ctx: TenantContext, permission: str, resource: ResourceRef | None = None) -> bool:
        """Non-raising scope check (used by navigation and UI-mirroring endpoints)."""
        try:
            self.require(ctx, permission, resource)
            return True
        except (Forbidden, ResourceNotFound):
            return False

    def require(
        self, ctx: TenantContext, permission: str, resource: ResourceRef | None = None
    ) -> None:
        """Raise unless the principal may perform *permission* on *resource* (plan §5.2).

        Resource ``None`` is a tenant-level action and needs a TENANT-scope grant. A resource in
        another tenant raises ResourceNotFound (404), not Forbidden, so existence never leaks.
        """
        self.catalogue.validate(permission)
        grants = [g for g in ctx.grants if g.permission == permission]
        if not grants:
            raise Forbidden(detail=f"Missing permission {permission}.")

        if resource is None:
            if any(g.scope_type == "TENANT" for g in grants):
                return
            raise Forbidden(detail=f"Permission {permission} requires tenant scope.")

        if resource.tenant_id != ctx.tenant_id:
            raise ResourceNotFound()

        for g in grants:
            if g.scope_type == "TENANT":
                return
            if g.scope_type == "PROJECT" and g.scope_id is not None \
               and g.scope_id == resource.project_id:
                return
            if g.scope_type == "PROVIDER" and g.scope_id is not None \
               and g.scope_id == resource.provider_id:
                return
        raise Forbidden(detail=f"{permission} not permitted on this resource.")

    def visible_modules(self, ctx: TenantContext) -> list[dict]:
        """Navigation items the principal may see (REQ-002, FN-IAM-06)."""
        out: list[dict] = []
        for label, route, perm in NAV_REGISTRY:
            if perm is None or self.has_permission(ctx, perm):
                out.append({"label": label, "route": route, "required_permission": perm})
        return out


@lru_cache
def get() -> Authorizer:
    return Authorizer(catalogue())

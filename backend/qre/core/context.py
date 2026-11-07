"""Request identity and scope: TenantContext, ResourceRef, Grant (LLD §4.1, Table 14).

The TenantContext is immutable and built per request by SVC-02 from the validated session and the
principal's current role assignments (never from client headers — REQ-006). The Authorizer reads
it; nothing else may mutate it.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class Grant:
    """One (permission, scope) the principal holds, from role_assignment ⋈ role_permission."""

    permission: str
    scope_type: str  # TENANT | PROJECT | PROVIDER
    scope_id: str | None  # NULL for TENANT scope


@dataclass(frozen=True, slots=True)
class ResourceRef:
    """The tenant/project/provider a protected object belongs to, for scope checks."""

    tenant_id: str
    project_id: str | None = None
    provider_id: str | None = None

    @classmethod
    def tenant(cls, tenant_id: str) -> ResourceRef:
        return cls(tenant_id=tenant_id)

    @classmethod
    def project(cls, tenant_id: str, project_id: str) -> ResourceRef:
        return cls(tenant_id=tenant_id, project_id=project_id)

    @classmethod
    def provider(cls, tenant_id: str, provider_id: str) -> ResourceRef:
        return cls(tenant_id=tenant_id, provider_id=provider_id)


@dataclass(frozen=True, slots=True)
class TenantContext:
    """Immutable per-request identity and authorisation scope."""

    tenant_id: str
    principal_id: str
    principal_type: str  # USER | SERVICE
    correlation_id: str
    grants: frozenset[Grant]
    membership_version: int

    def permissions(self) -> frozenset[str]:
        """All distinct permission codes the principal holds in any scope."""
        return frozenset(g.permission for g in self.grants)

    def grants_for(self, permission: str) -> tuple[Grant, ...]:
        return tuple(g for g in self.grants if g.permission == permission)

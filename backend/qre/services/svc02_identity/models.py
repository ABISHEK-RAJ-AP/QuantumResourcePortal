"""SQLAlchemy models for SVC-02 Identity and RBAC (LLD §4.3, Appendix B + QRP extensions).

These mirror the DDL in migrations 0002–0003 exactly; `tests/integration/test_rbac_schema.py`
reflects the migrated database and asserts the two agree, so drift fails the build. Migrations
are the authoritative DDL (raw SQL, LLD Appendix B verbatim where it applies); these classes are
the application's typed view of the same tables.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    CHAR,
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    SmallInteger,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import INET
from sqlalchemy.orm import Mapped, mapped_column

from qre.core.db import Base

ULID = CHAR(26)


class Tenant(Base):
    __tablename__ = "tenant"
    tenant_id: Mapped[str] = mapped_column(ULID, primary_key=True)
    code: Mapped[str] = mapped_column(String(32), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, server_default="ACTIVE")
    # settings JSONB and timestamps exist in the DB; authz_version added in migration 0003.
    authz_version: Mapped[int] = mapped_column(Integer, nullable=False, server_default="1")


class AppUser(Base):
    __tablename__ = "app_user"
    user_id: Mapped[str] = mapped_column(ULID, primary_key=True)
    home_tenant_id: Mapped[str] = mapped_column(ULID, ForeignKey("tenant.tenant_id"), nullable=False)
    username: Mapped[str] = mapped_column(String(128), nullable=False, unique=True)
    email: Mapped[str | None] = mapped_column(String(254))
    display_name: Mapped[str] = mapped_column(String(200), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, server_default="ACTIVE")
    auth_mode: Mapped[str] = mapped_column(String(16), nullable=False, server_default="LOCAL")
    mfa_enrolled: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    membership_version: Mapped[int] = mapped_column(Integer, nullable=False, server_default="1")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    created_by: Mapped[str | None] = mapped_column(ULID)  # QRP extension
    updated_by: Mapped[str | None] = mapped_column(ULID)  # QRP extension
    deactivated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))  # QRP extension


class UserCredential(Base):
    __tablename__ = "user_credential"
    user_id: Mapped[str] = mapped_column(
        ULID, ForeignKey("app_user.user_id", ondelete="CASCADE"), primary_key=True
    )
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    totp_secret_ref: Mapped[str | None] = mapped_column(String(128))
    password_changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    failed_count: Mapped[int] = mapped_column(SmallInteger, nullable=False, server_default="0")
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Session(Base):
    __tablename__ = "session"
    sid_hash: Mapped[str] = mapped_column(CHAR(64), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(ULID, ForeignKey("tenant.tenant_id"), nullable=False)
    principal_id: Mapped[str] = mapped_column(ULID, nullable=False)
    csrf_hash: Mapped[str] = mapped_column(CHAR(64), nullable=False)
    mfa_satisfied: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    auth_method: Mapped[str] = mapped_column(String(12), nullable=False)
    membership_version: Mapped[int] = mapped_column(Integer, nullable=False, server_default="1")  # QRP ext
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class LoginAttempt(Base):
    __tablename__ = "login_attempt"
    attempt_id: Mapped[str] = mapped_column(ULID, primary_key=True)
    username_hash: Mapped[str] = mapped_column(CHAR(64), nullable=False)
    ip: Mapped[str] = mapped_column(INET, nullable=False)
    outcome: Mapped[str] = mapped_column(String(16), nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ServiceIdentity(Base):
    __tablename__ = "service_identity"
    service_id: Mapped[str] = mapped_column(ULID, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(ULID, ForeignKey("tenant.tenant_id"), nullable=False)
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    kind: Mapped[str] = mapped_column(String(16), nullable=False)
    scopes: Mapped[list[str]] = mapped_column(Text, nullable=False, server_default="{}")  # TEXT[] in DB
    status: Mapped[str] = mapped_column(String(16), nullable=False, server_default="ACTIVE")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ApiToken(Base):
    __tablename__ = "api_token"
    token_id: Mapped[str] = mapped_column(ULID, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(ULID, ForeignKey("tenant.tenant_id"), nullable=False)
    principal_id: Mapped[str] = mapped_column(ULID, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    token_prefix: Mapped[str] = mapped_column(CHAR(8), nullable=False)
    token_hash: Mapped[str] = mapped_column(CHAR(64), nullable=False, unique=True)
    scopes: Mapped[list[str]] = mapped_column(Text, nullable=False, server_default="{}")
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class FederatedIdentity(Base):
    __tablename__ = "federated_identity"
    federated_identity_id: Mapped[str] = mapped_column(ULID, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(ULID, ForeignKey("tenant.tenant_id"), nullable=False)
    user_id: Mapped[str] = mapped_column(ULID, ForeignKey("app_user.user_id"), nullable=False)
    idp_id: Mapped[str] = mapped_column(String(64), nullable=False)
    subject: Mapped[str] = mapped_column(String(255), nullable=False)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Project(Base):
    __tablename__ = "project"
    project_id: Mapped[str] = mapped_column(ULID, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(ULID, ForeignKey("tenant.tenant_id"), nullable=False)
    code: Mapped[str] = mapped_column(String(32), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, server_default="ACTIVE")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    row_version: Mapped[int] = mapped_column(Integer, nullable=False, server_default="1")


class Provider(Base):
    __tablename__ = "provider"
    provider_id: Mapped[str] = mapped_column(ULID, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(ULID, ForeignKey("tenant.tenant_id"), nullable=False)
    code: Mapped[str] = mapped_column(String(32), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, server_default="DRAFT")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# --------------------------------------------------------------------------- RBAC (R-01)


class Role(Base):
    __tablename__ = "role"
    role_id: Mapped[str] = mapped_column(ULID, primary_key=True)
    tenant_id: Mapped[str | None] = mapped_column(ULID, ForeignKey("tenant.tenant_id"))  # NULL = system
    code: Mapped[str] = mapped_column(String(32), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(String(500), nullable=False, server_default="")
    assignable_scope: Mapped[str] = mapped_column(String(16), nullable=False)  # TENANT|PROJECT|PROVIDER
    is_system: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    status: Mapped[str] = mapped_column(String(16), nullable=False, server_default="ACTIVE")
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    row_version: Mapped[int] = mapped_column(Integer, nullable=False, server_default="1")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    created_by: Mapped[str | None] = mapped_column(ULID)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_by: Mapped[str | None] = mapped_column(ULID)


class Permission(Base):
    __tablename__ = "permission"
    permission_id: Mapped[str] = mapped_column(ULID, primary_key=True)
    code: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    module: Mapped[str] = mapped_column(String(32), nullable=False)
    action: Mapped[str] = mapped_column(String(24), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(String(500), nullable=False, server_default="")
    is_privileged: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    status: Mapped[str] = mapped_column(String(16), nullable=False, server_default="ACTIVE")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class RolePermission(Base):
    __tablename__ = "role_permission"
    role_id: Mapped[str] = mapped_column(
        ULID, ForeignKey("role.role_id", ondelete="RESTRICT"), primary_key=True
    )
    permission_id: Mapped[str] = mapped_column(
        ULID, ForeignKey("permission.permission_id", ondelete="RESTRICT"), primary_key=True
    )
    granted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    granted_by: Mapped[str | None] = mapped_column(ULID)


class RoleAssignment(Base):
    __tablename__ = "role_assignment"
    membership_id: Mapped[str] = mapped_column(ULID, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(ULID, ForeignKey("tenant.tenant_id"), nullable=False)
    principal_id: Mapped[str] = mapped_column(ULID, nullable=False)
    principal_type: Mapped[str] = mapped_column(String(8), nullable=False, server_default="USER")
    role: Mapped[str] = mapped_column(String(32), nullable=False)  # LLD role code (kept)
    role_id: Mapped[str] = mapped_column(
        ULID, ForeignKey("role.role_id", ondelete="RESTRICT"), nullable=False
    )  # QRP extension
    scope_type: Mapped[str] = mapped_column(String(16), nullable=False)  # TENANT|PROJECT|PROVIDER
    scope_id: Mapped[str | None] = mapped_column(ULID)
    granted_by: Mapped[str] = mapped_column(ULID, nullable=False)
    granted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoked_by: Mapped[str | None] = mapped_column(ULID)  # QRP extension
    revoke_reason: Mapped[str | None] = mapped_column(String(500))  # QRP extension


# BigInteger imported for parity with audit model's partition bookkeeping if needed later.
_ = BigInteger

"""Identity tables (SVC-02): users, credentials, sessions, tokens, federation, projects, providers.

Source: LLD v1.1.0 Appendix B (statements kept close to verbatim). QRP extension columns are
marked ``-- QRP ext``; they are additive and recorded as an LLD change request (plan §6.1).
Each phase migrates and verifies on its own, and downgrade drops exactly what upgrade created.

Revision ID: 0002
Revises: 0001
Create Date: 2026-11-06
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE app_user (
            user_id CHAR(26) NOT NULL,
            home_tenant_id CHAR(26) NOT NULL,
            username VARCHAR(128) NOT NULL,
            email VARCHAR(254),
            display_name VARCHAR(200) NOT NULL,
            status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
            auth_mode VARCHAR(16) NOT NULL DEFAULT 'LOCAL',
            mfa_enrolled BOOLEAN NOT NULL DEFAULT false,
            membership_version INTEGER NOT NULL DEFAULT 1,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            created_by CHAR(26),                      -- QRP ext
            updated_by CHAR(26),                      -- QRP ext
            deactivated_at TIMESTAMPTZ,               -- QRP ext
            CONSTRAINT pk_app_user PRIMARY KEY (user_id),
            CONSTRAINT uq_app_user_1 UNIQUE (username),
            CONSTRAINT fk_app_user_1 FOREIGN KEY (home_tenant_id) REFERENCES tenant(tenant_id),
            CONSTRAINT ck_app_user_status CHECK (status IN ('ACTIVE','DISABLED','PENDING'))
        )
        """
    )

    op.execute(
        """
        CREATE TABLE user_credential (
            user_id CHAR(26) NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            totp_secret_ref VARCHAR(128),
            password_changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            failed_count SMALLINT NOT NULL DEFAULT 0,
            locked_until TIMESTAMPTZ,
            CONSTRAINT pk_user_credential PRIMARY KEY (user_id),
            CONSTRAINT fk_user_credential_1 FOREIGN KEY (user_id)
                REFERENCES app_user(user_id) ON DELETE CASCADE
        )
        """
    )

    op.execute(
        """
        CREATE TABLE federated_identity (
            federated_identity_id CHAR(26) NOT NULL,
            tenant_id CHAR(26) NOT NULL,
            user_id CHAR(26) NOT NULL,
            idp_id VARCHAR(64) NOT NULL,
            subject VARCHAR(255) NOT NULL,
            last_login_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT pk_federated_identity PRIMARY KEY (federated_identity_id),
            CONSTRAINT uq_federated_identity_1 UNIQUE (idp_id, subject),
            CONSTRAINT fk_federated_identity_1 FOREIGN KEY (user_id) REFERENCES app_user(user_id),
            CONSTRAINT fk_federated_identity_2 FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id)
        )
        """
    )

    op.execute(
        """
        CREATE TABLE service_identity (
            service_id CHAR(26) NOT NULL,
            tenant_id CHAR(26) NOT NULL,
            name VARCHAR(64) NOT NULL,
            kind VARCHAR(16) NOT NULL,
            scopes TEXT[] NOT NULL DEFAULT '{}',
            status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT pk_service_identity PRIMARY KEY (service_id),
            CONSTRAINT uq_service_identity_1 UNIQUE (tenant_id, name),
            CONSTRAINT fk_service_identity_1 FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id)
        )
        """
    )

    op.execute(
        """
        CREATE TABLE api_token (
            token_id CHAR(26) NOT NULL,
            tenant_id CHAR(26) NOT NULL,
            principal_id CHAR(26) NOT NULL,
            name VARCHAR(100) NOT NULL,
            token_prefix CHAR(8) NOT NULL,
            token_hash CHAR(64) NOT NULL,
            scopes TEXT[] NOT NULL DEFAULT '{}',
            expires_at TIMESTAMPTZ NOT NULL,
            last_used_at TIMESTAMPTZ,
            revoked_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT pk_api_token PRIMARY KEY (token_id),
            CONSTRAINT uq_api_token_1 UNIQUE (token_hash),
            CONSTRAINT fk_api_token_1 FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id)
        )
        """
    )

    op.execute(
        """
        CREATE TABLE login_attempt (
            attempt_id CHAR(26) NOT NULL,
            username_hash CHAR(64) NOT NULL,
            ip INET NOT NULL,
            outcome VARCHAR(16) NOT NULL,
            occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT pk_login_attempt PRIMARY KEY (attempt_id)
        )
        """
    )
    op.execute("CREATE INDEX ix_login_attempt_1 ON login_attempt (username_hash, occurred_at)")

    op.execute(
        """
        CREATE TABLE session (
            sid_hash CHAR(64) NOT NULL,
            tenant_id CHAR(26) NOT NULL,
            principal_id CHAR(26) NOT NULL,
            csrf_hash CHAR(64) NOT NULL,
            mfa_satisfied BOOLEAN NOT NULL DEFAULT false,
            auth_method VARCHAR(12) NOT NULL,
            membership_version INTEGER NOT NULL DEFAULT 1,   -- QRP ext (LLD §4.3.1 lists it)
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            revoked_at TIMESTAMPTZ,
            CONSTRAINT pk_session PRIMARY KEY (sid_hash),
            CONSTRAINT fk_session_1 FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id)
        )
        """
    )
    op.execute("CREATE INDEX ix_session_1 ON session (principal_id)")

    op.execute(
        """
        CREATE TABLE project (
            project_id CHAR(26) NOT NULL,
            tenant_id CHAR(26) NOT NULL,
            code VARCHAR(32) NOT NULL,
            name VARCHAR(200) NOT NULL,
            status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            row_version INTEGER NOT NULL DEFAULT 1,
            CONSTRAINT pk_project PRIMARY KEY (project_id),
            CONSTRAINT uq_project_1 UNIQUE (tenant_id, code),
            CONSTRAINT fk_project_1 FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id)
        )
        """
    )

    # Minimal provider table — enough to be a PROVIDER scope target (full SVC-03 in repo Phase 4).
    op.execute(
        """
        CREATE TABLE provider (
            provider_id CHAR(26) NOT NULL,
            tenant_id CHAR(26) NOT NULL,
            code VARCHAR(32) NOT NULL,
            name VARCHAR(200) NOT NULL,
            status VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT pk_provider PRIMARY KEY (provider_id),
            CONSTRAINT uq_provider_1 UNIQUE (tenant_id, code),
            CONSTRAINT fk_provider_1 FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id)
        )
        """
    )


def downgrade() -> None:
    # Reverse dependency order; IF EXISTS keeps downgrade idempotent (contrast: a prior project's
    # downgrade failed on a missing index — see the Q-TeleScope audit).
    for table in (
        "provider",
        "project",
        "session",
        "login_attempt",
        "api_token",
        "service_identity",
        "federated_identity",
        "user_credential",
        "app_user",
    ):
        op.execute(f"DROP TABLE IF EXISTS {table}")

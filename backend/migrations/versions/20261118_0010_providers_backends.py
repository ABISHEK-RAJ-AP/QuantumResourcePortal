"""Provider registry and backend catalogue.

Revision ID: 0010
Revises: 0009
Create Date: 2026-11-18
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0010"
down_revision: str | None = "0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # SQLAlchemy text() treats ":false" in JSON defaults as a bind param — escape as \:false
    op.execute(
        """
        CREATE TABLE catalogue_provider (
            tenant_id CHAR(26) NOT NULL,
            provider_id VARCHAR(128) NOT NULL,
            provider_name VARCHAR(256) NOT NULL,
            status VARCHAR(24) NOT NULL DEFAULT 'draft',
            integration JSONB NOT NULL DEFAULT '{"stage":"I1","manifest_registered"\:false}',
            created_by CHAR(26),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT pk_catalogue_provider PRIMARY KEY (tenant_id, provider_id),
            CONSTRAINT fk_catalogue_provider_tenant FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id),
            CONSTRAINT fk_catalogue_provider_user FOREIGN KEY (created_by) REFERENCES app_user(user_id),
            CONSTRAINT ck_catalogue_provider_status CHECK (
                status IN ('draft', 'active', 'suspended')
            )
        )
        """
    )
    op.execute(
        """
        CREATE TABLE catalogue_backend (
            tenant_id CHAR(26) NOT NULL,
            backend_id VARCHAR(128) NOT NULL,
            provider_id VARCHAR(128) NOT NULL,
            backend_name VARCHAR(256) NOT NULL,
            operational_status VARCHAR(24) NOT NULL DEFAULT 'OFFLINE',
            qubit_count INTEGER,
            qpu_modality VARCHAR(64),
            topology_type VARCHAR(64),
            topology JSONB NOT NULL DEFAULT '{"nodes":[],"edges":[]}',
            queue_snapshot JSONB NOT NULL DEFAULT
                '{"pending_jobs":0,"queue_condition":"idle","trend":"flat"}',
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT pk_catalogue_backend PRIMARY KEY (tenant_id, backend_id),
            CONSTRAINT fk_catalogue_backend_provider FOREIGN KEY (tenant_id, provider_id)
                REFERENCES catalogue_provider (tenant_id, provider_id),
            CONSTRAINT ck_catalogue_backend_status CHECK (
                operational_status IN ('ONLINE', 'OFFLINE', 'MAINTENANCE')
            )
        )
        """
    )
    op.execute(
        "CREATE INDEX ix_catalogue_backend_provider ON catalogue_backend (tenant_id, provider_id)"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS catalogue_backend")
    op.execute("DROP TABLE IF EXISTS catalogue_provider")
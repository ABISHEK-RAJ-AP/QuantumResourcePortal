"""Provider jobs and durable dispatch attempts.

Revision ID: 0011
Revises: 0010
Create Date: 2026-11-18
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0011"
down_revision: str | None = "0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE provider_job (
            tenant_id CHAR(26) NOT NULL,
            job_id VARCHAR(256) NOT NULL,
            backend_id VARCHAR(128),
            status VARCHAR(24) NOT NULL,
            runtime VARCHAR(64),
            failure_category_label VARCHAR(128),
            failure_reason TEXT,
            submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            timeline JSONB NOT NULL DEFAULT '[]',
            CONSTRAINT pk_provider_job PRIMARY KEY (tenant_id, job_id),
            CONSTRAINT fk_provider_job_tenant FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id),
            CONSTRAINT ck_provider_job_status CHECK (
                status IN ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED')
            )
        )
        """
    )
    op.execute(
        "CREATE INDEX ix_provider_job_tenant_backend ON provider_job (tenant_id, backend_id, submitted_at DESC)"
    )
    op.execute(
        """
        CREATE TABLE dispatch_attempt (
            attempt_id CHAR(26) NOT NULL,
            tenant_id CHAR(26) NOT NULL,
            workload_id CHAR(26) NOT NULL,
            backend_id VARCHAR(128),
            execution_class VARCHAR(32),
            dispatch_state VARCHAR(32) NOT NULL,
            external_job_id VARCHAR(256),
            provider_ref VARCHAR(256),
            reconcile_reason TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT pk_dispatch_attempt PRIMARY KEY (attempt_id),
            CONSTRAINT fk_dispatch_attempt_tenant FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id),
            CONSTRAINT fk_dispatch_attempt_workload FOREIGN KEY (workload_id) REFERENCES workload(workload_id),
            CONSTRAINT ck_dispatch_attempt_state CHECK (
                dispatch_state IN (
                    'dispatch_authorized',
                    'dispatch_unresolved',
                    'dispatch_confirmed',
                    'dispatch_failed'
                )
            )
        )
        """
    )
    op.execute(
        "CREATE INDEX ix_dispatch_attempt_tenant ON dispatch_attempt (tenant_id, updated_at DESC)"
    )
    op.execute(
        "CREATE INDEX ix_dispatch_attempt_workload ON dispatch_attempt (workload_id, updated_at DESC)"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS dispatch_attempt")
    op.execute("DROP TABLE IF EXISTS provider_job")
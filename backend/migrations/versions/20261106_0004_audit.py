"""audit_log (SVC-17): append-only, hash-chained, range-partitioned by month.

Source: LLD Appendix B. The append-only trigger reuses ``qre_append_only()`` from the baseline.
A DEFAULT partition guarantees inserts succeed before the monthly partition-maintenance job runs
(lab profile); production adds monthly partitions ahead of time. Hash-chain values are written by
``qre.services.svc17_audit.service.write_audit`` (plan §6, D-15 advisory lock).

Revision ID: 0004
Revises: 0003
Create Date: 2026-11-06
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE audit_log (
            audit_id CHAR(26) NOT NULL,
            tenant_id CHAR(26) NOT NULL,
            occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            actor_id CHAR(26),
            actor_type VARCHAR(8) NOT NULL,
            action VARCHAR(48) NOT NULL,
            target_type VARCHAR(32),
            target_id VARCHAR(64),
            outcome VARCHAR(12) NOT NULL,
            detail JSONB NOT NULL DEFAULT '{}',
            ip INET,
            correlation_id VARCHAR(64) NOT NULL,
            prev_hash CHAR(64) NOT NULL,
            row_hash CHAR(64) NOT NULL,
            CONSTRAINT pk_audit_log PRIMARY KEY (audit_id, occurred_at)
        ) PARTITION BY RANGE (occurred_at)
        """
    )
    # Default partition so any timestamp is accepted in the lab profile.
    op.execute("CREATE TABLE audit_log_default PARTITION OF audit_log DEFAULT")
    op.execute("CREATE INDEX ix_audit_log_1 ON audit_log (tenant_id, occurred_at DESC)")
    op.execute("CREATE INDEX ix_audit_log_2 ON audit_log (tenant_id, action)")
    op.execute(
        "CREATE INDEX ix_audit_log_3 ON audit_log (tenant_id, target_type, target_id, occurred_at DESC)"
    )

    # Append-only: block UPDATE/DELETE (function defined in the baseline migration 0001).
    op.execute(
        "CREATE TRIGGER trg_append_only_audit BEFORE UPDATE OR DELETE ON audit_log "
        "FOR EACH ROW EXECUTE FUNCTION qre_append_only()"
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_append_only_audit ON audit_log")
    # Dropping the partitioned parent drops its partitions.
    op.execute("DROP TABLE IF EXISTS audit_log")

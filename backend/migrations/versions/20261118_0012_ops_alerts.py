"""Operational alerts (tenant-scoped, empty until detectors run).

Revision ID: 0012
Revises: 0011
Create Date: 2026-11-18
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0012"
down_revision: str | None = "0011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE ops_alert (
            alert_id CHAR(26) NOT NULL,
            tenant_id CHAR(26) NOT NULL,
            backend_id VARCHAR(128),
            resource_id VARCHAR(256),
            incident_id CHAR(26),
            alert_type VARCHAR(64) NOT NULL DEFAULT 'detector',
            severity VARCHAR(16) NOT NULL DEFAULT 'WARNING',
            status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
            title VARCHAR(256) NOT NULL,
            message TEXT,
            current_value NUMERIC,
            threshold_value NUMERIC,
            detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            comments JSONB NOT NULL DEFAULT '[]',
            CONSTRAINT pk_ops_alert PRIMARY KEY (alert_id),
            CONSTRAINT fk_ops_alert_tenant FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id),
            CONSTRAINT ck_ops_alert_severity CHECK (
                severity IN ('CRITICAL', 'WARNING', 'INFO')
            ),
            CONSTRAINT ck_ops_alert_status CHECK (
                status IN ('ACTIVE', 'ACKNOWLEDGED', 'RESOLVED')
            )
        )
        """
    )
    op.execute(
        "CREATE INDEX ix_ops_alert_tenant_status ON ops_alert (tenant_id, status, detected_at DESC)"
    )
    op.execute(
        "CREATE INDEX ix_ops_alert_resource ON ops_alert (tenant_id, resource_id)"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS ops_alert")
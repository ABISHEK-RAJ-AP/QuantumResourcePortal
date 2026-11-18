"""Virtual pools and operational incidents.

Revision ID: 0013
Revises: 0012
Create Date: 2026-11-18
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0013"
down_revision: str | None = "0012"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE virtual_pool (
            pool_id CHAR(26) NOT NULL,
            tenant_id CHAR(26) NOT NULL,
            name VARCHAR(80) NOT NULL,
            description TEXT,
            created_by CHAR(26),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT pk_virtual_pool PRIMARY KEY (pool_id),
            CONSTRAINT fk_virtual_pool_tenant FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id),
            CONSTRAINT uq_virtual_pool_name UNIQUE (tenant_id, name)
        )
        """
    )
    op.execute(
        """
        CREATE TABLE virtual_pool_member (
            pool_id CHAR(26) NOT NULL,
            tenant_id CHAR(26) NOT NULL,
            asset_id CHAR(26) NOT NULL,
            added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT pk_virtual_pool_member PRIMARY KEY (pool_id, asset_id),
            CONSTRAINT fk_vpm_pool FOREIGN KEY (pool_id) REFERENCES virtual_pool(pool_id),
            CONSTRAINT fk_vpm_asset FOREIGN KEY (asset_id) REFERENCES inventory_asset (asset_id)
        )
        """
    )
    op.execute(
        """
        CREATE TABLE ops_incident (
            incident_id CHAR(26) NOT NULL,
            tenant_id CHAR(26) NOT NULL,
            title VARCHAR(256) NOT NULL,
            summary TEXT,
            status VARCHAR(24) NOT NULL DEFAULT 'OPEN',
            severity VARCHAR(16) NOT NULL DEFAULT 'WARNING',
            backend_id VARCHAR(128),
            owner VARCHAR(128),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT pk_ops_incident PRIMARY KEY (incident_id),
            CONSTRAINT fk_ops_incident_tenant FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id),
            CONSTRAINT ck_ops_incident_status CHECK (
                status IN ('OPEN', 'ACKNOWLEDGED', 'INVESTIGATING', 'RESOLVED', 'CLOSED')
            ),
            CONSTRAINT ck_ops_incident_severity CHECK (
                severity IN ('CRITICAL', 'WARNING', 'INFO')
            )
        )
        """
    )
    op.execute(
        "CREATE INDEX ix_ops_incident_tenant_status ON ops_incident (tenant_id, status, updated_at DESC)"
    )
    op.execute(
        """
        ALTER TABLE ops_alert
        ADD CONSTRAINT fk_ops_alert_incident
        FOREIGN KEY (incident_id) REFERENCES ops_incident(incident_id)
        """
    )


def downgrade() -> None:
    op.execute("ALTER TABLE ops_alert DROP CONSTRAINT IF EXISTS fk_ops_alert_incident")
    op.execute("DROP TABLE IF EXISTS ops_incident")
    op.execute("DROP TABLE IF EXISTS virtual_pool_member")
    op.execute("DROP TABLE IF EXISTS virtual_pool")
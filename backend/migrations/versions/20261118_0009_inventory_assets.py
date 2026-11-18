"""Inventory assets (tenant catalogue).

Revision ID: 0009
Revises: 0008
Create Date: 2026-11-18
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0009"
down_revision: str | None = "0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE inventory_asset (
            asset_id CHAR(26) NOT NULL,
            tenant_id CHAR(26) NOT NULL,
            provider_id VARCHAR(128) NOT NULL,
            native_asset_id VARCHAR(256) NOT NULL,
            asset_class VARCHAR(64) NOT NULL,
            execution_class VARCHAR(32) NOT NULL,
            lifecycle_state VARCHAR(24) NOT NULL DEFAULT 'registered',
            created_by CHAR(26) NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT pk_inventory_asset PRIMARY KEY (asset_id),
            CONSTRAINT fk_inventory_asset_tenant FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id),
            CONSTRAINT fk_inventory_asset_user FOREIGN KEY (created_by) REFERENCES app_user(user_id),
            CONSTRAINT uq_inventory_asset_native UNIQUE (tenant_id, provider_id, native_asset_id),
            CONSTRAINT ck_inventory_asset_execution CHECK (
                execution_class IN ('simulated', 'hardware')
            ),
            CONSTRAINT ck_inventory_asset_lifecycle CHECK (
                lifecycle_state IN (
                    'registered', 'active', 'maintenance', 'suspended', 'retired'
                )
            )
        )
        """
    )
    op.execute(
        "CREATE INDEX ix_inventory_asset_tenant_lifecycle "
        "ON inventory_asset (tenant_id, lifecycle_state, created_at DESC)"
    )
    op.execute(
        "CREATE INDEX ix_inventory_asset_tenant_exec "
        "ON inventory_asset (tenant_id, execution_class)"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS inventory_asset")
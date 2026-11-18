"""Provider registry and backend catalogue.

Revision ID: 0010
Revises: 0009
Create Date: 2026-11-18
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "0010"
down_revision: str | None = "0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_DEFAULT_INTEGRATION = sa.text(
    "jsonb_build_object('stage', 'I1', 'manifest_registered', false)"
)
_DEFAULT_TOPOLOGY = sa.text(
    "jsonb_build_object('nodes', jsonb_build_array(), 'edges', jsonb_build_array())"
)
_DEFAULT_QUEUE = sa.text(
    "jsonb_build_object('pending_jobs', 0, 'queue_condition', 'idle', 'trend', 'flat')"
)


def upgrade() -> None:
    op.create_table(
        "catalogue_provider",
        sa.Column("tenant_id", sa.CHAR(26), nullable=False),
        sa.Column("provider_id", sa.String(128), nullable=False),
        sa.Column("provider_name", sa.String(256), nullable=False),
        sa.Column("status", sa.String(24), server_default="draft", nullable=False),
        sa.Column("integration", JSONB, server_default=_DEFAULT_INTEGRATION, nullable=False),
        sa.Column("created_by", sa.CHAR(26), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenant.tenant_id"]),
        sa.ForeignKeyConstraint(["created_by"], ["app_user.user_id"]),
        sa.PrimaryKeyConstraint("tenant_id", "provider_id", name="pk_catalogue_provider"),
        sa.CheckConstraint(
            "status IN ('draft', 'active', 'suspended')",
            name="ck_catalogue_provider_status",
        ),
    )
    op.create_table(
        "catalogue_backend",
        sa.Column("tenant_id", sa.CHAR(26), nullable=False),
        sa.Column("backend_id", sa.String(128), nullable=False),
        sa.Column("provider_id", sa.String(128), nullable=False),
        sa.Column("backend_name", sa.String(256), nullable=False),
        sa.Column(
            "operational_status",
            sa.String(24),
            server_default="OFFLINE",
            nullable=False,
        ),
        sa.Column("qubit_count", sa.Integer(), nullable=True),
        sa.Column("qpu_modality", sa.String(64), nullable=True),
        sa.Column("topology_type", sa.String(64), nullable=True),
        sa.Column("topology", JSONB, server_default=_DEFAULT_TOPOLOGY, nullable=False),
        sa.Column("queue_snapshot", JSONB, server_default=_DEFAULT_QUEUE, nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["tenant_id", "provider_id"],
            ["catalogue_provider.tenant_id", "catalogue_provider.provider_id"],
            name="fk_catalogue_backend_provider",
        ),
        sa.PrimaryKeyConstraint("tenant_id", "backend_id", name="pk_catalogue_backend"),
        sa.CheckConstraint(
            "operational_status IN ('ONLINE', 'OFFLINE', 'MAINTENANCE')",
            name="ck_catalogue_backend_status",
        ),
    )
    op.create_index(
        "ix_catalogue_backend_provider",
        "catalogue_backend",
        ["tenant_id", "provider_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_catalogue_backend_provider", table_name="catalogue_backend")
    op.drop_table("catalogue_backend")
    op.drop_table("catalogue_provider")
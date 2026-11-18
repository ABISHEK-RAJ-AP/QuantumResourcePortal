"""Seed PROJECT_VIEWER role from permissions.yaml (idempotent).

Revision ID: 0008
Revises: 0007
Create Date: 2026-11-18
"""

from collections.abc import Sequence

from alembic import op

from qre.core.rbac_seed import seed_catalogue

revision: str = "0008"
down_revision: str | None = "0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    seed_catalogue(op.get_bind())


def downgrade() -> None:
    pass
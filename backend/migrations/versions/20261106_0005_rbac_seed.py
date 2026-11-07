"""Seed the RBAC catalogue from backend/permissions.yaml (system roles + permissions).

Idempotent: re-running inserts only what is missing (see qre.core.rbac_seed). System-role writes
run under the seeding GUC so the immutability triggers allow them. Later catalogue changes ship as
new migrations that call the same loader — this applied migration is never edited (plan §6.5).

Revision ID: 0005
Revises: 0004
Create Date: 2026-11-06
"""

from collections.abc import Sequence

from alembic import op

from qre.core.rbac_seed import remove_system_catalogue, seed_catalogue

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    seed_catalogue(op.get_bind())


def downgrade() -> None:
    remove_system_catalogue(op.get_bind())

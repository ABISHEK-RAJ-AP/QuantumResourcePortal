"""Reservation holds (governance windows on resource_ref).

Revision ID: 0007
Revises: 0006
Create Date: 2026-11-18
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0007"
down_revision: str | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE reservation (
            reservation_id CHAR(26) NOT NULL,
            tenant_id CHAR(26) NOT NULL,
            project_id CHAR(26),
            resource_ref VARCHAR(256) NOT NULL,
            purpose TEXT NOT NULL,
            window_start TIMESTAMPTZ NOT NULL,
            window_end TIMESTAMPTZ NOT NULL,
            state VARCHAR(24) NOT NULL DEFAULT 'requested',
            created_by CHAR(26) NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT pk_reservation PRIMARY KEY (reservation_id),
            CONSTRAINT fk_reservation_tenant FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id),
            CONSTRAINT fk_reservation_project FOREIGN KEY (project_id) REFERENCES project(project_id),
            CONSTRAINT fk_reservation_user FOREIGN KEY (created_by) REFERENCES app_user(user_id),
            CONSTRAINT ck_reservation_window CHECK (window_end > window_start),
            CONSTRAINT ck_reservation_state CHECK (
                state IN ('requested', 'active', 'released', 'cancelled')
            )
        )
        """
    )
    op.execute(
        "CREATE INDEX ix_reservation_tenant_state ON reservation (tenant_id, state, window_start)"
    )
    op.execute(
        "CREATE INDEX ix_reservation_resource ON reservation (tenant_id, resource_ref, window_start)"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS reservation")
"""Baseline: extensions, append-only trigger function and the tenant table.

Source: LLD v1.1.0 Appendix B (statements copied verbatim). Later phases add their tables in
separate revisions so each phase can be migrated and verified on its own.

Revision ID: 0001
Revises:
Create Date: 2026-11-02
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Needed by the reservation exclusion constraint (SVC-07, LLD §4.8.1).
    op.execute("CREATE EXTENSION IF NOT EXISTS btree_gist")

    # Used by triggers on approval_decision and audit_log (append-only, REQ-040, REQ-008).
    op.execute(
        """
        CREATE OR REPLACE FUNCTION qre_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'append-only table %', TG_TABLE_NAME USING ERRCODE = 'P0001'; END $$;
        """
    )

    # tenant: Isolation boundary for users, projects, backends and policies.
    op.execute(
        """
        CREATE TABLE tenant (
            tenant_id CHAR(26) NOT NULL,
            code VARCHAR(32) NOT NULL,
            name VARCHAR(200) NOT NULL,
            status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
            settings JSONB NOT NULL DEFAULT '{}',
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT pk_tenant PRIMARY KEY (tenant_id),
            CONSTRAINT uq_tenant_1 UNIQUE (code)
        )
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS tenant")
    op.execute("DROP FUNCTION IF EXISTS qre_append_only()")
    # btree_gist is left installed: other objects in the database may depend on it.

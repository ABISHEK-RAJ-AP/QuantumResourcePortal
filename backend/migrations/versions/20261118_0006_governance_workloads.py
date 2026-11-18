"""Governance workspace: project extensions, workload_submission, workload (approvals).

Revision ID: 0006
Revises: 0005
Create Date: 2026-11-18
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE project
            ADD COLUMN IF NOT EXISTS description TEXT,
            ADD COLUMN IF NOT EXISTS project_type VARCHAR(32) NOT NULL DEFAULT 'quantum_circuit',
            ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false,
            ADD COLUMN IF NOT EXISTS submission_lock BOOLEAN NOT NULL DEFAULT false,
            ADD COLUMN IF NOT EXISTS created_by CHAR(26)
        """
    )
    op.execute(
        """
        CREATE TABLE workload_submission (
            submission_id CHAR(26) NOT NULL,
            tenant_id CHAR(26) NOT NULL,
            project_id CHAR(26) NOT NULL,
            created_by CHAR(26) NOT NULL,
            status VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
            metadata JSONB NOT NULL DEFAULT '{}',
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT pk_workload_submission PRIMARY KEY (submission_id),
            CONSTRAINT fk_workload_submission_tenant FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id),
            CONSTRAINT fk_workload_submission_project FOREIGN KEY (project_id) REFERENCES project(project_id),
            CONSTRAINT fk_workload_submission_user FOREIGN KEY (created_by) REFERENCES app_user(user_id),
            CONSTRAINT ck_workload_submission_status CHECK (status IN ('DRAFT', 'SUBMITTED'))
        )
        """
    )
    op.execute("CREATE INDEX ix_workload_submission_project ON workload_submission (project_id, status)")

    op.execute(
        """
        CREATE TABLE workload (
            workload_id CHAR(26) NOT NULL,
            tenant_id CHAR(26) NOT NULL,
            project_id CHAR(26) NOT NULL,
            submission_id CHAR(26) NOT NULL,
            created_by CHAR(26) NOT NULL,
            governance_state VARCHAR(32) NOT NULL,
            metadata JSONB NOT NULL DEFAULT '{}',
            stage_index SMALLINT NOT NULL DEFAULT 0,
            stages JSONB NOT NULL DEFAULT '[]',
            history JSONB NOT NULL DEFAULT '[]',
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT pk_workload PRIMARY KEY (workload_id),
            CONSTRAINT uq_workload_submission UNIQUE (submission_id),
            CONSTRAINT fk_workload_tenant FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id),
            CONSTRAINT fk_workload_project FOREIGN KEY (project_id) REFERENCES project(project_id),
            CONSTRAINT fk_workload_submission FOREIGN KEY (submission_id)
                REFERENCES workload_submission(submission_id),
            CONSTRAINT fk_workload_user FOREIGN KEY (created_by) REFERENCES app_user(user_id)
        )
        """
    )
    op.execute("CREATE INDEX ix_workload_tenant_state ON workload (tenant_id, governance_state)")
    op.execute("CREATE INDEX ix_workload_project ON workload (project_id)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS workload")
    op.execute("DROP TABLE IF EXISTS workload_submission")
    op.execute(
        """
        ALTER TABLE project
            DROP COLUMN IF EXISTS created_by,
            DROP COLUMN IF EXISTS submission_lock,
            DROP COLUMN IF EXISTS is_archived,
            DROP COLUMN IF EXISTS project_type,
            DROP COLUMN IF EXISTS description
        """
    )
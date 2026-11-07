"""RBAC tables: role, permission, role_permission; extend role_assignment and tenant.

Implements the schema in RBAC_IMPLEMENTATION_PLAN.md §6.2 (validated against PostgreSQL 16 in
RBAC-1). Adds the integrity triggers from plan §6.3: no-shadow of system role codes, system-role
permission lock (seed-guarded), and assignment scope-match. The LLD role_assignment unique
constraint is replaced per decision R-17 (it blocked re-grant and let NULL-scope duplicates
through).

Revision ID: 0003
Revises: 0002
Create Date: 2026-11-06
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # tenant.authz_version — bumped whenever a role's permission set or status changes so cached
    # authorisation contexts rebuild (plan §5.4).
    op.execute("ALTER TABLE tenant ADD COLUMN authz_version INTEGER NOT NULL DEFAULT 1")

    op.execute(
        """
        CREATE TABLE role (
            role_id CHAR(26) NOT NULL,
            tenant_id CHAR(26),                        -- NULL = system (global) role
            code VARCHAR(32) NOT NULL,
            name VARCHAR(100) NOT NULL,
            description VARCHAR(500) NOT NULL DEFAULT '',
            assignable_scope VARCHAR(16) NOT NULL,
            is_system BOOLEAN NOT NULL DEFAULT false,
            status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
            deleted_at TIMESTAMPTZ,
            row_version INTEGER NOT NULL DEFAULT 1,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            created_by CHAR(26),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_by CHAR(26),
            CONSTRAINT pk_role PRIMARY KEY (role_id),
            CONSTRAINT fk_role_1 FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id),
            CONSTRAINT ck_role_status CHECK (status IN ('ACTIVE','INACTIVE')),
            CONSTRAINT ck_role_scope CHECK (assignable_scope IN ('TENANT','PROJECT','PROVIDER')),
            CONSTRAINT ck_role_system_global CHECK (is_system = (tenant_id IS NULL)),
            CONSTRAINT ck_role_system_not_deleted CHECK (NOT is_system OR deleted_at IS NULL)
        )
        """
    )
    # One live code per tenant (system roles share the NULL-tenant namespace via '*').
    op.execute(
        "CREATE UNIQUE INDEX ux_role_code ON role (COALESCE(tenant_id, '*'), code) "
        "WHERE deleted_at IS NULL"
    )
    op.execute("CREATE UNIQUE INDEX ux_role_system_code ON role (code) WHERE is_system")

    op.execute(
        """
        CREATE TABLE permission (
            permission_id CHAR(26) NOT NULL,
            code VARCHAR(64) NOT NULL,
            module VARCHAR(32) NOT NULL,
            action VARCHAR(24) NOT NULL,
            name VARCHAR(100) NOT NULL,
            description VARCHAR(500) NOT NULL DEFAULT '',
            is_privileged BOOLEAN NOT NULL DEFAULT false,
            status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT pk_permission PRIMARY KEY (permission_id),
            CONSTRAINT uq_permission_1 UNIQUE (code)
        )
        """
    )

    op.execute(
        """
        CREATE TABLE role_permission (
            role_id CHAR(26) NOT NULL,
            permission_id CHAR(26) NOT NULL,
            granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            granted_by CHAR(26),
            CONSTRAINT pk_role_permission PRIMARY KEY (role_id, permission_id),
            CONSTRAINT fk_role_permission_1 FOREIGN KEY (role_id)
                REFERENCES role(role_id) ON DELETE RESTRICT,
            CONSTRAINT fk_role_permission_2 FOREIGN KEY (permission_id)
                REFERENCES permission(permission_id) ON DELETE RESTRICT
        )
        """
    )
    op.execute("CREATE INDEX ix_role_permission_1 ON role_permission (permission_id)")

    # role_assignment — LLD columns, plus QRP extensions (role_id FK, revoked_by, revoke_reason).
    op.execute(
        """
        CREATE TABLE role_assignment (
            membership_id CHAR(26) NOT NULL,
            tenant_id CHAR(26) NOT NULL,
            principal_id CHAR(26) NOT NULL,
            principal_type VARCHAR(8) NOT NULL DEFAULT 'USER',
            role VARCHAR(32) NOT NULL,                 -- LLD role code (kept)
            role_id CHAR(26) NOT NULL,                 -- QRP ext
            scope_type VARCHAR(16) NOT NULL,
            scope_id CHAR(26),
            granted_by CHAR(26) NOT NULL,
            granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            revoked_at TIMESTAMPTZ,
            revoked_by CHAR(26),                       -- QRP ext
            revoke_reason VARCHAR(500),                -- QRP ext
            CONSTRAINT pk_role_assignment PRIMARY KEY (membership_id),
            CONSTRAINT fk_role_assignment_1 FOREIGN KEY (tenant_id) REFERENCES tenant(tenant_id),
            CONSTRAINT fk_role_assignment_2 FOREIGN KEY (role_id)
                REFERENCES role(role_id) ON DELETE RESTRICT,
            CONSTRAINT ck_role_assignment_scope
                CHECK (scope_type IN ('TENANT','PROJECT','PROVIDER')),
            CONSTRAINT ck_role_assignment_tenant_scope
                CHECK ((scope_type = 'TENANT') = (scope_id IS NULL))
        )
        """
    )
    op.execute("CREATE INDEX ix_role_assignment_1 ON role_assignment (principal_id, tenant_id)")
    op.execute(
        "CREATE INDEX ix_role_assignment_2 ON role_assignment (role_id) WHERE revoked_at IS NULL"
    )
    # R-17: one active assignment per (principal, role, scope); re-grant after revoke is allowed.
    op.execute(
        """
        CREATE UNIQUE INDEX ux_role_assignment_active
        ON role_assignment (tenant_id, principal_id, role_id, scope_type, COALESCE(scope_id, '*'))
        WHERE revoked_at IS NULL
        """
    )

    # --- Triggers (plan §6.3) ------------------------------------------------------------------

    # A custom (tenant) role code may not shadow a system role code.
    op.execute(
        """
        CREATE OR REPLACE FUNCTION qre_role_no_shadow() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
            IF NEW.is_system THEN RETURN NEW; END IF;
            IF EXISTS (SELECT 1 FROM role WHERE is_system AND code = NEW.code) THEN
                RAISE EXCEPTION 'role code % is reserved by a system role', NEW.code
                    USING ERRCODE = 'P0001';
            END IF;
            RETURN NEW;
        END $$;
        """
    )
    op.execute(
        "CREATE TRIGGER trg_role_no_shadow BEFORE INSERT OR UPDATE ON role "
        "FOR EACH ROW EXECUTE FUNCTION qre_role_no_shadow()"
    )

    # System-role permissions and core fields are immutable except while seeding
    # (SET LOCAL qre.seeding='on'), so the API can never alter SRS Appendix B at runtime.
    op.execute(
        """
        CREATE OR REPLACE FUNCTION qre_role_permission_system_lock() RETURNS trigger
        LANGUAGE plpgsql AS $$
        DECLARE rid CHAR(26); sys BOOLEAN;
        BEGIN
            IF current_setting('qre.seeding', true) = 'on' THEN RETURN COALESCE(NEW, OLD); END IF;
            rid := COALESCE(NEW.role_id, OLD.role_id);
            SELECT is_system INTO sys FROM role WHERE role_id = rid;
            IF sys THEN
                RAISE EXCEPTION 'permissions of system roles are immutable (role_id %)', rid
                    USING ERRCODE = 'P0001';
            END IF;
            RETURN COALESCE(NEW, OLD);
        END $$;
        """
    )
    op.execute(
        "CREATE TRIGGER trg_role_permission_system_lock "
        "BEFORE INSERT OR UPDATE OR DELETE ON role_permission "
        "FOR EACH ROW EXECUTE FUNCTION qre_role_permission_system_lock()"
    )

    op.execute(
        """
        CREATE OR REPLACE FUNCTION qre_role_system_immutable() RETURNS trigger
        LANGUAGE plpgsql AS $$
        BEGIN
            IF current_setting('qre.seeding', true) = 'on' THEN RETURN COALESCE(NEW, OLD); END IF;
            IF TG_OP = 'DELETE' AND OLD.is_system THEN
                RAISE EXCEPTION 'system role % cannot be deleted', OLD.code USING ERRCODE = 'P0001';
            END IF;
            IF TG_OP = 'UPDATE' AND OLD.is_system
               AND (NEW.code <> OLD.code OR NEW.assignable_scope <> OLD.assignable_scope
                    OR NEW.status <> OLD.status OR NEW.is_system <> OLD.is_system) THEN
                RAISE EXCEPTION 'system role % core fields are immutable', OLD.code
                    USING ERRCODE = 'P0001';
            END IF;
            RETURN COALESCE(NEW, OLD);
        END $$;
        """
    )
    op.execute(
        "CREATE TRIGGER trg_role_system_immutable BEFORE UPDATE OR DELETE ON role "
        "FOR EACH ROW EXECUTE FUNCTION qre_role_system_immutable()"
    )

    # An assignment's scope_type must match the role's assignable_scope, and a PROJECT/PROVIDER
    # scope_id must reference an object in the same tenant (plan §5.2, §6.3).
    op.execute(
        """
        CREATE OR REPLACE FUNCTION qre_role_assignment_scope() RETURNS trigger
        LANGUAGE plpgsql AS $$
        DECLARE want VARCHAR(16); ok BOOLEAN;
        BEGIN
            SELECT assignable_scope INTO want FROM role WHERE role_id = NEW.role_id;
            IF want IS NULL THEN
                RAISE EXCEPTION 'role % not found', NEW.role_id USING ERRCODE = 'P0001';
            END IF;
            IF want <> NEW.scope_type THEN
                RAISE EXCEPTION 'role scope % does not match assignment scope %', want, NEW.scope_type
                    USING ERRCODE = 'P0001';
            END IF;
            IF NEW.scope_type = 'PROJECT' THEN
                SELECT EXISTS(SELECT 1 FROM project
                             WHERE project_id = NEW.scope_id AND tenant_id = NEW.tenant_id) INTO ok;
                IF NOT ok THEN
                    RAISE EXCEPTION 'project scope % not in tenant %', NEW.scope_id, NEW.tenant_id
                        USING ERRCODE = 'P0001';
                END IF;
            ELSIF NEW.scope_type = 'PROVIDER' THEN
                SELECT EXISTS(SELECT 1 FROM provider
                             WHERE provider_id = NEW.scope_id AND tenant_id = NEW.tenant_id) INTO ok;
                IF NOT ok THEN
                    RAISE EXCEPTION 'provider scope % not in tenant %', NEW.scope_id, NEW.tenant_id
                        USING ERRCODE = 'P0001';
                END IF;
            END IF;
            RETURN NEW;
        END $$;
        """
    )
    op.execute(
        "CREATE TRIGGER trg_role_assignment_scope BEFORE INSERT OR UPDATE ON role_assignment "
        "FOR EACH ROW EXECUTE FUNCTION qre_role_assignment_scope()"
    )


def downgrade() -> None:
    for trg, tbl in (
        ("trg_role_assignment_scope", "role_assignment"),
        ("trg_role_system_immutable", "role"),
        ("trg_role_permission_system_lock", "role_permission"),
        ("trg_role_no_shadow", "role"),
    ):
        op.execute(f"DROP TRIGGER IF EXISTS {trg} ON {tbl}")
    for fn in (
        "qre_role_assignment_scope",
        "qre_role_system_immutable",
        "qre_role_permission_system_lock",
        "qre_role_no_shadow",
    ):
        op.execute(f"DROP FUNCTION IF EXISTS {fn}()")
    op.execute("DROP TABLE IF EXISTS role_assignment")
    op.execute("DROP TABLE IF EXISTS role_permission")
    op.execute("DROP TABLE IF EXISTS permission")
    op.execute("DROP TABLE IF EXISTS role")
    op.execute("ALTER TABLE tenant DROP COLUMN IF EXISTS authz_version")

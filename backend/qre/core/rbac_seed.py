"""Load the RBAC catalogue (backend/permissions.yaml) into the database.

The same catalogue drives the generated matrix (RBAC-2) and this seed (RBAC-3). Seeding is
idempotent (INSERT … WHERE NOT EXISTS on the natural key), so re-running it — from migration 0005
or a future reseed command — never duplicates and never disturbs custom roles. Writes to
system-role permissions run under ``SET LOCAL qre.seeding = 'on'`` so the immutability triggers
let the seed through while still blocking the API.

Works against a synchronous SQLAlchemy Connection (Alembic passes ``op.get_bind()``).
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml
from sqlalchemy import text
from sqlalchemy.engine import Connection

from qre.core.ids import new_ulid

PERMISSIONS_FILE = Path(__file__).resolve().parents[2] / "permissions.yaml"


def load_catalogue(path: Path | None = None) -> dict[str, Any]:
    """Parse permissions.yaml and return the raw mapping."""
    with (path or PERMISSIONS_FILE).open(encoding="utf-8") as fh:
        return yaml.safe_load(fh)


def seed_catalogue(conn: Connection, catalogue: dict[str, Any] | None = None) -> dict[str, int]:
    """Insert permissions, system roles and their role_permission links. Idempotent.

    Returns counts of rows inserted this run.
    """
    data = catalogue or load_catalogue()
    conn.execute(text("SET LOCAL qre.seeding = 'on'"))
    counts = {"permissions": 0, "roles": 0, "role_permissions": 0}

    for p in data["permissions"]:
        res = conn.execute(
            text(
                """
                INSERT INTO permission (permission_id, code, module, action, name,
                                        description, is_privileged)
                SELECT :id, :code, :module, :action, :name, :desc, :priv
                WHERE NOT EXISTS (SELECT 1 FROM permission WHERE code = CAST(:code AS VARCHAR))
                """
            ),
            {
                "id": new_ulid(),
                "code": p["code"],
                "module": p["module"],
                "action": p["action"],
                "name": p["name"],
                "desc": p.get("basis", ""),
                "priv": bool(p.get("privileged", False)),
            },
        )
        counts["permissions"] += res.rowcount or 0

    for code, role in data["roles"].items():
        res = conn.execute(
            text(
                """
                INSERT INTO role (role_id, tenant_id, code, name, description,
                                  assignable_scope, is_system, status)
                SELECT :id, NULL, :code, :name, :desc, :scope, true, 'ACTIVE'
                WHERE NOT EXISTS (
                    SELECT 1 FROM role WHERE code = CAST(:code AS VARCHAR) AND is_system)
                """
            ),
            {
                "id": new_ulid(),
                "code": code,
                "name": role["name"],
                "desc": role.get("description", ""),
                "scope": role["assignable_scope"],
            },
        )
        counts["roles"] += res.rowcount or 0

    for code, role in data["roles"].items():
        for pcode in role.get("permissions", []):
            res = conn.execute(
                text(
                    """
                    INSERT INTO role_permission (role_id, permission_id)
                    SELECT r.role_id, p.permission_id
                    FROM role r, permission p
                    WHERE r.code = :rc AND r.is_system AND p.code = :pc
                      AND NOT EXISTS (
                          SELECT 1 FROM role_permission rp
                          WHERE rp.role_id = r.role_id AND rp.permission_id = p.permission_id)
                    """
                ),
                {"rc": code, "pc": pcode},
            )
            counts["role_permissions"] += res.rowcount or 0

    return counts


def remove_system_catalogue(conn: Connection) -> None:
    """Downgrade helper: delete the seeded system roles/permissions (seed-guarded).

    Assignments to system roles are cleared first: a seed downgrade removes the catalogue, and
    migration 0003's downgrade drops the role_assignment table immediately after, so those rows
    are going away regardless. Only the ``role`` table is guarded by a trigger here.
    """
    conn.execute(text("SET LOCAL qre.seeding = 'on'"))
    # The whole permission catalogue is being removed, so every role_permission row (system or
    # custom) is cleared first; migration 0003's downgrade drops the role tables immediately after.
    conn.execute(
        text("DELETE FROM role_assignment "
             "WHERE role_id IN (SELECT role_id FROM role WHERE is_system)")
    )
    conn.execute(text("DELETE FROM role_permission"))
    conn.execute(text("DELETE FROM role WHERE is_system"))
    conn.execute(text("DELETE FROM permission"))

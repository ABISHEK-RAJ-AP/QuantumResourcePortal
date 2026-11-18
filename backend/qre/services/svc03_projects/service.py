"""Project read/write against the tenant ``project`` table."""

from __future__ import annotations

import re

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from qre.core import authz
from qre.core.context import ResourceRef, TenantContext
from qre.core.errors import ResourceNotFound, ValidationFailed
from qre.core.ids import is_ulid, new_ulid

_CODE_SAFE = re.compile(r"[^A-Z0-9]+")


def _slug_code(name: str, suffix: str) -> str:
    base = _CODE_SAFE.sub("_", name.strip().upper())[:20].strip("_") or "PRJ"
    return f"{base}_{suffix[-6:]}"[:32]


async def _username(session: AsyncSession, user_id: str | None) -> str | None:
    if not user_id:
        return None
    row = (
        await session.execute(
            text("SELECT username FROM app_user WHERE user_id = :u"),
            {"u": user_id},
        )
    ).scalar()
    return str(row) if row else None


def _project_dict(row: dict, owner_username: str | None) -> dict:
    return {
        "project_id": row["project_id"],
        "name": row["name"],
        "code": row["code"],
        "description": row.get("description"),
        "project_type": row.get("project_type") or "quantum_circuit",
        "status": (row.get("status") or "ACTIVE").lower(),
        "is_archived": bool(row.get("is_archived")),
        "submission_lock": bool(row.get("submission_lock")),
        "owner_username": owner_username,
        "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
        "updated_at": row["updated_at"].isoformat() if row.get("updated_at") else None,
    }


async def list_projects(session: AsyncSession, ctx: TenantContext) -> list[dict]:
    rows = (
        await session.execute(
            text(
                """
                SELECT p.project_id, p.code, p.name, p.description, p.project_type, p.status,
                       p.is_archived, p.submission_lock, p.created_by, p.created_at, p.updated_at
                FROM project p
                WHERE p.tenant_id = :t
                ORDER BY p.created_at DESC
                """
            ),
            {"t": ctx.tenant_id},
        )
    ).mappings().all()
    out: list[dict] = []
    for row in rows:
        pid = row["project_id"]
        if not authz.get().can(ctx, "project:read", ResourceRef.project(ctx.tenant_id, pid)):
            continue
        owner = await _username(session, row.get("created_by"))
        out.append(_project_dict(dict(row), owner))
    return out


async def get_project(session: AsyncSession, ctx: TenantContext, project_id: str) -> dict:
    if not is_ulid(project_id):
        raise ValidationFailed(field_errors={"project_id": "Invalid project id."})
    row = (
        await session.execute(
            text(
                """
                SELECT p.project_id, p.code, p.name, p.description, p.project_type, p.status,
                       p.is_archived, p.submission_lock, p.created_by, p.created_at, p.updated_at,
                       p.tenant_id
                FROM project p
                WHERE p.project_id = :p
                """
            ),
            {"p": project_id},
        )
    ).mappings().first()
    if not row or row["tenant_id"] != ctx.tenant_id:
        raise ResourceNotFound()
    authz.get().require(ctx, "project:read", ResourceRef.project(ctx.tenant_id, project_id))
    owner = await _username(session, row.get("created_by"))
    return _project_dict(dict(row), owner)


async def create_project(
    session: AsyncSession,
    ctx: TenantContext,
    *,
    name: str,
    description: str | None = None,
    project_type: str = "quantum_circuit",
) -> dict:
    authz.get().require(ctx, "project:create", ResourceRef.tenant(ctx.tenant_id))
    name = name.strip()
    if len(name) < 1:
        raise ValidationFailed(field_errors={"name": "Name is required."})
    pid = new_ulid()
    code = _slug_code(name, pid)
    await session.execute(
        text(
            """
            INSERT INTO project (
                project_id, tenant_id, code, name, description, project_type, created_by
            ) VALUES (:id, :t, :c, :n, :d, :pt, :u)
            """
        ),
        {
            "id": pid,
            "t": ctx.tenant_id,
            "c": code,
            "n": name,
            "d": description,
            "pt": project_type[:32],
            "u": ctx.principal_id,
        },
    )
    row = {
        "project_id": pid,
        "code": code,
        "name": name,
        "description": description,
        "project_type": project_type,
        "status": "ACTIVE",
        "is_archived": False,
        "submission_lock": False,
        "created_by": ctx.principal_id,
        "created_at": None,
        "updated_at": None,
    }
    owner = await _username(session, ctx.principal_id)
    return _project_dict(row, owner)
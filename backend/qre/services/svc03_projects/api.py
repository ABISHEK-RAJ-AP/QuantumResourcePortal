"""Projects API (API-PRJ-01)."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from qre.core.context import TenantContext
from qre.core.deps import db_session, get_ctx, require_permission
from qre.services.svc03_projects import members as member_svc
from qre.services.svc03_projects import service as svc
from qre.services.svc03_projects.schemas import ProjectCreateIn, ProjectMemberIn

router = APIRouter(tags=["projects"])


@router.get("/projects")
async def list_projects(
    ctx: TenantContext = Depends(require_permission("project:read")),
    session: AsyncSession = Depends(db_session),
) -> dict:
    return {"items": await svc.list_projects(session, ctx)}


@router.post("/projects", status_code=201)
async def create_project(
    body: ProjectCreateIn,
    ctx: TenantContext = Depends(require_permission("project:create")),
    session: AsyncSession = Depends(db_session),
) -> dict:
    return await svc.create_project(
        session,
        ctx,
        name=body.name,
        description=body.description,
        project_type=body.project_type,
    )


@router.get("/projects/{project_id}")
async def get_project(
    project_id: str,
    ctx: TenantContext = Depends(require_permission("project:read")),
    session: AsyncSession = Depends(db_session),
) -> dict:
    return await svc.get_project(session, ctx, project_id)


@router.get("/projects/{project_id}/members")
async def list_project_members(
    project_id: str,
    ctx: TenantContext = Depends(get_ctx),
    session: AsyncSession = Depends(db_session),
) -> dict:
    return await member_svc.list_project_members(session, ctx, project_id)


@router.post("/projects/{project_id}/members", status_code=201)
async def add_project_member(
    project_id: str,
    body: ProjectMemberIn,
    ctx: TenantContext = Depends(get_ctx),
    session: AsyncSession = Depends(db_session),
) -> dict:
    return await member_svc.add_project_member(
        session, ctx, project_id, username=body.username, role=body.role
    )
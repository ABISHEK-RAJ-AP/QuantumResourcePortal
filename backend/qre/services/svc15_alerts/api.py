"""Alerts API (read + ack/resolve)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.ext.asyncio import AsyncSession

from qre.core.context import TenantContext
from qre.core.deps import db_session, get_ctx, require_permission
from qre.services.svc15_alerts import incidents as incident_svc
from qre.services.svc15_alerts import service as svc

router = APIRouter(tags=["alerts"])


class AlertCommentIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    text: str = Field(min_length=1, max_length=2000)


class AlertAckIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    comment: str | None = Field(default=None, max_length=2000)


class AlertResolveIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    resolution_notes: str | None = Field(default=None, max_length=2000)


@router.get("/alerts/summary")
async def alerts_summary(
    ctx: TenantContext = Depends(require_permission("alert:read")),
    session: AsyncSession = Depends(db_session),
) -> dict:
    return await svc.alerts_summary(session, ctx)


@router.get("/alerts")
async def list_alerts(
    ctx: TenantContext = Depends(require_permission("alert:read")),
    session: AsyncSession = Depends(db_session),
    status: str | None = Query(None),
    resource_id: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
) -> dict:
    return await svc.list_alerts(
        session, ctx, status=status, resource_id=resource_id, limit=limit
    )


@router.get("/alerts/{alert_id}")
async def get_alert(
    alert_id: str,
    ctx: TenantContext = Depends(require_permission("alert:read")),
    session: AsyncSession = Depends(db_session),
) -> dict:
    return await svc.get_alert(session, ctx, alert_id)


@router.post("/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(
    alert_id: str,
    body: AlertAckIn,
    ctx: TenantContext = Depends(get_ctx),
    session: AsyncSession = Depends(db_session),
) -> dict:
    if body.comment:
        await svc.add_comment(session, ctx, alert_id, text_body=body.comment)
    return await svc.acknowledge_alert(session, ctx, alert_id)


@router.post("/alerts/{alert_id}/resolve")
async def resolve_alert(
    alert_id: str,
    body: AlertResolveIn,
    ctx: TenantContext = Depends(get_ctx),
    session: AsyncSession = Depends(db_session),
) -> dict:
    if body.resolution_notes:
        await svc.add_comment(session, ctx, alert_id, text_body=body.resolution_notes)
    return await svc.resolve_alert(session, ctx, alert_id)


@router.post("/alerts/{alert_id}/comments")
async def alert_comment(
    alert_id: str,
    body: AlertCommentIn,
    ctx: TenantContext = Depends(require_permission("alert:ack")),
    session: AsyncSession = Depends(db_session),
) -> dict:
    return await svc.add_comment(session, ctx, alert_id, text_body=body.text)


@router.get("/incidents")
async def list_incidents(
    ctx: TenantContext = Depends(require_permission("incident:read")),
    session: AsyncSession = Depends(db_session),
    limit: int = Query(50, ge=1, le=200),
) -> dict:
    return await incident_svc.list_incidents(session, ctx, limit=limit)


@router.get("/incidents/{incident_id}")
async def get_incident(
    incident_id: str,
    ctx: TenantContext = Depends(require_permission("incident:read")),
    session: AsyncSession = Depends(db_session),
) -> dict:
    return await incident_svc.get_incident(session, ctx, incident_id)


@router.post("/incidents/{incident_id}/acknowledge")
async def acknowledge_incident(
    incident_id: str,
    ctx: TenantContext = Depends(get_ctx),
    session: AsyncSession = Depends(db_session),
) -> dict:
    return await incident_svc.acknowledge_incident(session, ctx, incident_id)


@router.post("/incidents/{incident_id}/investigate")
async def investigate_incident(
    incident_id: str,
    ctx: TenantContext = Depends(get_ctx),
    session: AsyncSession = Depends(db_session),
) -> dict:
    return await incident_svc.investigate_incident(session, ctx, incident_id)


@router.post("/incidents/{incident_id}/resolve")
async def resolve_incident(
    incident_id: str,
    ctx: TenantContext = Depends(get_ctx),
    session: AsyncSession = Depends(db_session),
) -> dict:
    return await incident_svc.resolve_incident(session, ctx, incident_id)
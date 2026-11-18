"""Inventory assets API (API-INV-01)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from qre.core.context import TenantContext
from qre.core.deps import db_session, get_ctx, require_permission
from qre.services.svc04_inventory import backends as backend_svc
from qre.services.svc04_inventory import connectors as connector_svc
from qre.services.svc04_inventory import pools as pool_svc
from qre.services.svc04_inventory import providers as provider_svc
from qre.services.svc04_inventory import service as svc
from qre.services.svc04_inventory.schemas import (
    AssetCreateIn,
    AssetLifecycleIn,
    BackendCreateIn,
    PoolCreateIn,
    PoolMemberIn,
    ProviderCreateIn,
    ProviderOnboardingIn,
    ProviderTransitionIn,
)

router = APIRouter(tags=["inventory"])


@router.get("/inventory/assets")
async def list_assets(
    ctx: TenantContext = Depends(require_permission("asset:read")),
    session: AsyncSession = Depends(db_session),
    execution_class: str | None = Query(None),
    lifecycle_state: str | None = Query(None),
) -> dict:
    return await svc.list_assets(
        session,
        ctx,
        execution_class=execution_class,
        lifecycle_state=lifecycle_state,
    )


@router.post("/inventory/assets", status_code=201)
async def create_asset(
    body: AssetCreateIn,
    ctx: TenantContext = Depends(require_permission("asset:create")),
    session: AsyncSession = Depends(db_session),
) -> dict:
    return await svc.create_asset(
        session,
        ctx,
        provider_id=body.provider_id,
        native_asset_id=body.native_asset_id,
        asset_class=body.asset_class,
        execution_class=body.execution_class,
    )


@router.get("/inventory/assets/{asset_id}")
async def get_asset(
    asset_id: str,
    ctx: TenantContext = Depends(require_permission("asset:read")),
    session: AsyncSession = Depends(db_session),
) -> dict:
    return await svc.get_asset(session, ctx, asset_id)


@router.post("/inventory/assets/{asset_id}/lifecycle")
async def transition_lifecycle(
    asset_id: str,
    body: AssetLifecycleIn,
    ctx: TenantContext = Depends(get_ctx),
    session: AsyncSession = Depends(db_session),
) -> dict:
    return await svc.transition_lifecycle(
        session, ctx, asset_id, lifecycle_state=body.lifecycle_state
    )


@router.get("/providers")
async def list_providers(
    ctx: TenantContext = Depends(require_permission("provider:read")),
    session: AsyncSession = Depends(db_session),
) -> dict:
    return await provider_svc.list_providers(session, ctx)


@router.post("/providers", status_code=201)
async def create_provider(
    body: ProviderCreateIn,
    ctx: TenantContext = Depends(require_permission("provider:create")),
    session: AsyncSession = Depends(db_session),
) -> dict:
    return await provider_svc.create_provider(
        session,
        ctx,
        provider_id=body.provider_id,
        provider_name=body.provider_name,
    )


@router.post("/providers/{provider_id}/onboarding")
async def provider_onboarding(
    provider_id: str,
    body: ProviderOnboardingIn,
    ctx: TenantContext = Depends(require_permission("provider:manifest:write")),
    session: AsyncSession = Depends(db_session),
) -> dict:
    return await provider_svc.submit_onboarding(
        session,
        ctx,
        provider_id,
        operations=body.operations,
        execution_classes=body.execution_classes,
    )


@router.post("/providers/{provider_id}/transition")
async def provider_transition(
    provider_id: str,
    body: ProviderTransitionIn,
    ctx: TenantContext = Depends(get_ctx),
    session: AsyncSession = Depends(db_session),
) -> dict:
    return await provider_svc.transition_provider(
        session, ctx, provider_id, status=body.status
    )


@router.get("/virtual-pools")
async def list_pools(
    ctx: TenantContext = Depends(require_permission("pool:read")),
    session: AsyncSession = Depends(db_session),
) -> dict:
    return await pool_svc.list_pools(session, ctx)


@router.post("/virtual-pools", status_code=201)
async def create_pool(
    body: PoolCreateIn,
    ctx: TenantContext = Depends(require_permission("pool:manage")),
    session: AsyncSession = Depends(db_session),
) -> dict:
    return await pool_svc.create_pool(session, ctx, name=body.name)


@router.get("/virtual-pools/{pool_id}")
async def get_pool(
    pool_id: str,
    ctx: TenantContext = Depends(require_permission("pool:read")),
    session: AsyncSession = Depends(db_session),
) -> dict:
    return await pool_svc.get_pool(session, ctx, pool_id)


@router.post("/virtual-pools/{pool_id}/members")
async def add_pool_member(
    pool_id: str,
    body: PoolMemberIn,
    ctx: TenantContext = Depends(require_permission("pool:manage")),
    session: AsyncSession = Depends(db_session),
) -> dict:
    return await pool_svc.add_member(session, ctx, pool_id, asset_id=body.asset_id)


@router.get("/connectors")
async def connectors_board(
    ctx: TenantContext = Depends(require_permission("connector:read")),
    session: AsyncSession = Depends(db_session),
) -> dict:
    return await connector_svc.connectors_board(session, ctx)


@router.post("/backends", status_code=201)
async def create_backend(
    body: BackendCreateIn,
    ctx: TenantContext = Depends(require_permission("asset:create")),
    session: AsyncSession = Depends(db_session),
) -> dict:
    return await backend_svc.create_backend(
        session,
        ctx,
        backend_id=body.backend_id,
        provider_id=body.provider_id,
        backend_name=body.backend_name,
        operational_status=body.operational_status,
        qubit_count=body.qubit_count,
        qpu_modality=body.qpu_modality,
        topology_type=body.topology_type,
    )


@router.get("/backends")
async def list_backends(
    ctx: TenantContext = Depends(require_permission("provider:read")),
    session: AsyncSession = Depends(db_session),
) -> dict:
    return await backend_svc.list_backends(session, ctx)


@router.get("/backends/{backend_id}")
async def get_backend(
    backend_id: str,
    ctx: TenantContext = Depends(require_permission("provider:read")),
    session: AsyncSession = Depends(db_session),
) -> dict:
    return await backend_svc.get_backend(session, ctx, backend_id)


@router.get("/backends/{backend_id}/status")
async def backend_status(
    backend_id: str,
    ctx: TenantContext = Depends(require_permission("provider:read")),
    session: AsyncSession = Depends(db_session),
) -> dict:
    return await backend_svc.backend_status(session, ctx, backend_id)


@router.get("/backends/{backend_id}/topology")
async def backend_topology(
    backend_id: str,
    ctx: TenantContext = Depends(require_permission("provider:read")),
    session: AsyncSession = Depends(db_session),
) -> dict:
    return await backend_svc.backend_topology(session, ctx, backend_id)


@router.get("/queues")
async def list_queues(
    ctx: TenantContext = Depends(require_permission("provider:read")),
    session: AsyncSession = Depends(db_session),
) -> dict:
    return await backend_svc.list_queues(session, ctx)


@router.get("/queues/{backend_id}")
async def get_queue(
    backend_id: str,
    ctx: TenantContext = Depends(require_permission("provider:read")),
    session: AsyncSession = Depends(db_session),
) -> dict:
    return await backend_svc.get_queue(session, ctx, backend_id)
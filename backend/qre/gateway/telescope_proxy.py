"""QRP → TeleScope gateway proxy (RBAC-7f).

Module endpoints (inventory, approvals, projects, pools, dispatch, …) are served by TeleScope. The
SPA talks only to the QRP origin with its cookie session + CSRF; this router forwards any module
path
to TeleScope, translating the authenticated QRP principal into a TeleScope *service session* (minted
via the shared-secret ``/auth/service-login``). So one login, one CSRF scheme, and TeleScope still
enforces its own RBAC on the mapped role — no client ever chooses its own role.

Enforcement: the catch-all depends on ``get_ctx`` (valid QRP session required; CSRF checked on
unsafe methods). When ``telescope_gateway_secret`` is unset the proxy is disabled and paths 404.
"""
from __future__ import annotations

import asyncio
import logging
import time

import httpx
from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from qre.core.config import Settings
from qre.core.context import TenantContext
from qre.core.deps import db_session, get_ctx
from qre.core.errors import QreError

log = logging.getLogger("qre.gateway.proxy")

# QRP system role -> TeleScope role. Ranked most→least privileged so the principal's strongest role
# decides the mapping. Anything unmapped falls back to least privilege (Viewer). The platform admin
# maps to TeleScope's PlatformAdmin, which (post RBAC-7c) likewise cannot decide approvals — SoD
# holds across both backends; approval authority maps onto QuantumOpsAdmin.
_QRP_TO_TELESCOPE: tuple[tuple[str, str], ...] = (
    ("PLATFORM_ADMIN", "PlatformAdmin"),
    ("QUOTA_APPROVER", "QuantumOpsAdmin"),
    ("PROVIDER_ADMIN", "QuantumOpsAdmin"),
    ("RESOURCE_MANAGER", "QuantumOpsAdmin"),
    ("OPERATOR", "Operator"),
    ("AUDITOR", "Auditor"),
    ("PROJECT_OWNER", "Researcher"),
    ("RESEARCHER", "Researcher"),
    ("ASSISTANT", "Viewer"),
)
_RANK = {qrp: i for i, (qrp, _) in enumerate(_QRP_TO_TELESCOPE)}
_MAP = dict(_QRP_TO_TELESCOPE)
_DEFAULT_TELESCOPE_ROLE = "Viewer"

# Hop-by-hop and host-specific headers that must not be forwarded verbatim.
_STRIP_REQUEST_HEADERS = {
    "host", "content-length", "connection", "keep-alive", "transfer-encoding",
    "cookie", "x-csrf-token", "authorization", "x-qre-gateway-secret",
}
_STRIP_RESPONSE_HEADERS = {
    "content-length", "connection", "keep-alive", "transfer-encoding", "content-encoding",
    "set-cookie", "server", "date",
}


def map_role(qrp_roles: list[str]) -> str:
    """Pick the strongest QRP role the principal holds and map it to a TeleScope role."""
    best: str | None = None
    best_rank = len(_RANK) + 1
    for r in qrp_roles:
        rank = _RANK.get(r)
        if rank is not None and rank < best_rank:
            best, best_rank = r, rank
    return _MAP.get(best or "", _DEFAULT_TELESCOPE_ROLE)


async def _principal_roles(session: AsyncSession, ctx: TenantContext) -> list[str]:
    rows = await session.execute(
        text(
            "SELECT DISTINCT role FROM role_assignment "
            "WHERE tenant_id = :t AND principal_id = :p AND revoked_at IS NULL ORDER BY role"
        ),
        {"t": ctx.tenant_id, "p": ctx.principal_id},
    )
    return [r[0] for r in rows.all()]


class TelescopeTokenProvider:
    """Mint and cache TeleScope service sessions per (principal, role, tenant), short TTL."""

    def __init__(self, base_url: str, secret: str, ttl_s: int, client: httpx.AsyncClient):
        self._base = base_url.rstrip("/")
        self._secret = secret
        self._ttl = ttl_s
        self._client = client
        self._cache: dict[tuple[str, str, str], tuple[str, float]] = {}
        self._lock = asyncio.Lock()

    async def token(self, principal: str, role: str, tenant_id: str, *, force: bool = False) -> str:
        key = (principal, role, tenant_id)
        now = time.monotonic()
        if not force:
            hit = self._cache.get(key)
            if hit and hit[1] > now:
                return hit[0]
        async with self._lock:
            hit = self._cache.get(key)
            if hit and hit[1] > now and not force:
                return hit[0]
            resp = await self._client.post(
                f"{self._base}/api/v1/auth/service-login",
                headers={"X-QRE-Gateway-Secret": self._secret},
                json={"principal": principal, "role": role, "tenant_id": tenant_id},
            )
            if resp.status_code != 200:
                raise QreError(
                    f"TeleScope service-login failed ({resp.status_code}).",
                    code="CONNECTOR_FAILED",
                )
            tok = resp.json()["token"]
            self._cache[key] = (tok, now + self._ttl)
            return tok


def _get_client(request: Request, settings: Settings) -> httpx.AsyncClient:
    client = getattr(request.app.state, "telescope_client", None)
    if client is None:
        client = httpx.AsyncClient(timeout=settings.telescope_timeout_s)
        request.app.state.telescope_client = client
    return client


def _get_provider(request: Request, settings: Settings, secret: str) -> TelescopeTokenProvider:
    provider = getattr(request.app.state, "telescope_provider", None)
    if provider is None:
        provider = TelescopeTokenProvider(
            settings.telescope_base_url, secret, settings.telescope_token_ttl_s,
            _get_client(request, settings),
        )
        request.app.state.telescope_provider = provider
    return provider


def build_proxy_router() -> APIRouter:
    router = APIRouter()

    @router.api_route(
        "/{telescope_path:path}",
        methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        include_in_schema=False,
    )
    async def proxy(
        telescope_path: str,
        request: Request,
        ctx: TenantContext = Depends(get_ctx),
        session: AsyncSession = Depends(db_session),
    ) -> Response:
        settings: Settings = request.app.state.settings
        secret = settings.telescope_gateway_secret
        if secret is None:
            # Proxy disabled: behave as if the module path does not exist here.
            raise QreError(
                "Module endpoint is not available on this deployment.", code="RESOURCE_NOT_FOUND"
            )

        roles = await _principal_roles(session, ctx)
        ts_role = map_role(roles)
        provider = _get_provider(request, settings, secret.get_secret_value())
        client = _get_client(request, settings)

        body = await request.body()
        fwd_headers = {
            k: v for k, v in request.headers.items() if k.lower() not in _STRIP_REQUEST_HEADERS
        }
        url = f"{settings.telescope_base_url.rstrip('/')}/api/v1/{telescope_path}"

        async def _send() -> httpx.Response:
            tok = await provider.token(ctx.principal_id, ts_role, ctx.tenant_id)
            return await client.request(
                request.method,
                url,
                params=request.query_params,
                content=body,
                headers={**fwd_headers, "Authorization": f"Bearer {tok}"},
            )

        upstream = await _send()
        if upstream.status_code == 401:
            # Cached token expired upstream — mint a fresh one once and retry.
            tok = await provider.token(ctx.principal_id, ts_role, ctx.tenant_id, force=True)
            upstream = await client.request(
                request.method, url, params=request.query_params, content=body,
                headers={**fwd_headers, "Authorization": f"Bearer {tok}"},
            )

        resp_headers = {
            k: v for k, v in upstream.headers.items() if k.lower() not in _STRIP_RESPONSE_HEADERS
        }
        return Response(
            content=upstream.content,
            status_code=upstream.status_code,
            headers=resp_headers,
            media_type=upstream.headers.get("content-type"),
        )

    return router

"""Correlation-id and access-log middleware (LLD §4.2.1 rule 2, §4.2.5).

* Accepts an inbound ``X-Correlation-ID`` matching ``^[A-Za-z0-9-]{8,64}$``; otherwise a new
  ULID is generated. The id is echoed on every response and bound to the logging context.
* Writes one JSON access-log line per request: method, route template, status, duration.
  Query strings are never logged (they may contain tokens).

Implemented as pure ASGI middleware so it also wraps streaming responses.
"""

from __future__ import annotations

import logging
import re
import time

from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from qre.core.ids import new_ulid
from qre.core.logging import correlation_id_var

HEADER = "X-Correlation-ID"
_VALID = re.compile(r"^[A-Za-z0-9-]{8,64}$")
access_log = logging.getLogger("qre.access")


def resolve_correlation_id(inbound: str | None) -> str:
    """Keep a well-formed inbound id, otherwise generate a ULID."""
    if inbound and _VALID.fullmatch(inbound):
        return inbound
    return new_ulid()


class CorrelationMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        inbound = None
        for key, value in scope.get("headers", []):
            if key == b"x-correlation-id":
                inbound = value.decode("latin-1")
                break
        corr_id = resolve_correlation_id(inbound)
        token = correlation_id_var.set(corr_id)
        scope.setdefault("state", {})["correlation_id"] = corr_id

        status_holder = {"status": 500, "started": False}
        started = time.perf_counter()

        async def send_with_header(message: Message) -> None:
            if message["type"] == "http.response.start":
                status_holder["status"] = message["status"]
                status_holder["started"] = True
                MutableHeaders(scope=message)[HEADER] = corr_id
            await send(message)

        try:
            await self.app(scope, receive, send_with_header)
        except Exception as exc:
            # Unhandled error: answer here, while the correlation id is still bound, so the
            # 500 body and header carry it (LLD §4.2.4). Stack trace goes to the log only.
            if status_holder["started"]:
                raise
            from qre.gateway.problem import internal_error_response

            await internal_error_response(exc)(scope, receive, send_with_header)
        finally:
            route = scope.get("route")
            access_log.info(
                "request",
                extra={
                    "method": scope.get("method"),
                    "route": getattr(route, "path", scope.get("path")),
                    "status": status_holder["status"],
                    "duration_ms": round((time.perf_counter() - started) * 1000, 2),
                },
            )
            correlation_id_var.reset(token)

"""Liveness and readiness probes (LLD §13.6, API-SYS-01; REQ-N022).

* ``GET /healthz`` — process alive and event loop responsive. Never touches the database.
* ``GET /readyz``  — database reachable within QRE_READINESS_DB_TIMEOUT_MS, migration head in the
  database equals the code head, configuration valid. 200 when ready, 503 otherwise.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Literal

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from qre.core.config import APP_VERSION
from qre.core.db import CheckResult, Database

router = APIRouter(tags=["system"])


class CheckOut(BaseModel):
    ok: bool
    detail: str


class LivenessOut(BaseModel):
    status: Literal["ok"]
    version: str
    time: datetime


class ReadinessOut(BaseModel):
    status: Literal["ready", "not_ready"]
    version: str
    environment: str
    time: datetime
    checks: dict[str, CheckOut]


@router.get("/healthz", response_model=LivenessOut, summary="Liveness probe")
async def healthz() -> LivenessOut:
    return LivenessOut(status="ok", version=APP_VERSION, time=datetime.now(UTC))


@router.get(
    "/readyz",
    response_model=ReadinessOut,
    summary="Readiness probe",
    responses={503: {"model": ReadinessOut, "description": "Not ready"}},
)
async def readyz(request: Request) -> JSONResponse:
    db: Database = request.app.state.db
    database = await db.ping()
    if database.ok:
        migrations = await db.migration_check()
    else:
        migrations = CheckResult(False, "skipped: database unreachable")
    checks = {
        "configuration": CheckOut(ok=True, detail="valid"),  # invalid config never starts
        "database": CheckOut(ok=database.ok, detail=database.detail),
        "migrations": CheckOut(ok=migrations.ok, detail=migrations.detail),
    }
    ready = all(c.ok for c in checks.values())
    body = ReadinessOut(
        status="ready" if ready else "not_ready",
        version=APP_VERSION,
        environment=db.settings.env.value,
        time=datetime.now(UTC),
        checks=checks,
    )
    return JSONResponse(body.model_dump(mode="json"), status_code=200 if ready else 503)

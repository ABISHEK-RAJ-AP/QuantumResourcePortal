"""Daily shot ledger derived from approved workloads until job metering lands."""

from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from qre.core import authz
from qre.core.context import ResourceRef, TenantContext
from qre.core.errors import ResourceNotFound, ValidationFailed
from qre.core.ids import is_ulid

DEFAULT_CAP = 1000
DEFAULT_WARN_PCT = 80
DEFAULT_ESTIMATE_SHOTS = 100  # ponytail: until workload composer stores shots


def _shots_from_metadata(metadata: Any) -> int:
    if metadata is None:
        return DEFAULT_ESTIMATE_SHOTS
    if isinstance(metadata, str):
        try:
            metadata = json.loads(metadata)
        except json.JSONDecodeError:
            return DEFAULT_ESTIMATE_SHOTS
    if not isinstance(metadata, dict):
        return DEFAULT_ESTIMATE_SHOTS
    for key in ("shots", "estimated_shots", "requested_shots"):
        raw = metadata.get(key)
        if raw is not None:
            try:
                n = int(raw)
                return max(0, min(n, 1_000_000))
            except (TypeError, ValueError):
                continue
    return DEFAULT_ESTIMATE_SHOTS


def _window_bounds(window: str, *, now: datetime | None = None) -> tuple[datetime, datetime, str]:
    now = now or datetime.now(UTC)
    w = (window or "today").lower()
    if w == "today":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end = start + timedelta(days=1)
        return start, end, "today"
    if w == "7d":
        return now - timedelta(days=7), now, "7d"
    if w == "30d":
        return now - timedelta(days=30), now, "30d"
    if w == "all":
        return datetime(1970, 1, 1, tzinfo=UTC), now, "all"
    raise ValidationFailed(field_errors={"window": "Invalid window (today, 7d, 30d, all)."})


async def _tenant_quota_settings(session: AsyncSession, tenant_id: str) -> dict:
    row = (
        await session.execute(
            text("SELECT settings FROM tenant WHERE tenant_id = :t"),
            {"t": tenant_id},
        )
    ).scalar()
    settings = row if isinstance(row, dict) else {}
    cap = int(settings.get("daily_shots_cap", DEFAULT_CAP))
    warn = int(settings.get("warn_threshold_pct", DEFAULT_WARN_PCT))
    return {"daily_shots_cap": max(1, cap), "warn_threshold_pct": max(1, min(warn, 100))}


async def _workloads_in_window(
    session: AsyncSession,
    tenant_id: str,
    start: datetime,
    end: datetime,
    *,
    project_id: str | None,
) -> list[dict]:
    params: dict = {"t": tenant_id, "start": start, "end": end}
    clauses = [
        "w.tenant_id = :t",
        "w.governance_state = 'approved'",
        "w.updated_at >= :start",
        "w.updated_at < :end",
    ]
    if project_id:
        clauses.append("w.project_id = :p")
        params["p"] = project_id
    where = " AND ".join(clauses)
    rows = (
        await session.execute(
            text(
                f"""
                SELECT w.workload_id, w.project_id, p.name AS project_name, w.metadata,
                       w.governance_state AS status, w.updated_at, w.created_by
                FROM workload w
                JOIN project p ON p.project_id = w.project_id
                WHERE {where}
                ORDER BY w.updated_at DESC
                """
            ),
            params,
        )
    ).mappings().all()
    return [dict(r) for r in rows]


async def _username(session: AsyncSession, user_id: str) -> str:
    row = (
        await session.execute(text("SELECT username FROM app_user WHERE user_id = :u"), {"u": user_id})
    ).scalar()
    return str(row) if row else user_id


def _headroom_pct(cap: int, remaining: int) -> int:
    if cap <= 0:
        return 0
    return max(0, min(100, round(100 * remaining / cap)))


async def get_ledger(
    session: AsyncSession,
    ctx: TenantContext,
    *,
    window: str,
    project_id: str | None,
) -> dict:
    authz.get().require(ctx, "quota:read", ResourceRef.tenant(ctx.tenant_id))
    if project_id:
        if not is_ulid(project_id):
            raise ValidationFailed(field_errors={"project_id": "Invalid project id."})
        authz.get().require(ctx, "project:read", ResourceRef.project(ctx.tenant_id, project_id))
    start, end, label = _window_bounds(window)
    settings = await _tenant_quota_settings(session, ctx.tenant_id)
    cap = settings["daily_shots_cap"]
    warn = settings["warn_threshold_pct"]

    rows = await _workloads_in_window(session, ctx.tenant_id, start, end, project_id=project_id)
    lifetime_rows = await _workloads_in_window(
        session,
        ctx.tenant_id,
        datetime(1970, 1, 1, tzinfo=UTC),
        datetime.now(UTC) + timedelta(days=1),
        project_id=project_id,
    )

    entries: list[dict] = []
    by_project: dict[str, dict] = {}
    used = 0
    lifetime_used = 0

    for row in lifetime_rows:
        lifetime_used += _shots_from_metadata(row.get("metadata"))

    for row in rows:
        shots = _shots_from_metadata(row.get("metadata"))
        used += shots
        uname = await _username(session, row["created_by"])
        entries.append(
            {
                "workload_id": row["workload_id"],
                "project_id": row["project_id"],
                "project_name": row["project_name"],
                "shots": shots,
                "status": row["status"],
                "created_by": uname,
            }
        )
        pid = row["project_id"]
        bucket = by_project.setdefault(
            pid,
            {
                "project_id": pid,
                "project_name": row["project_name"],
                "shots": 0,
                "jobs": 0,
            },
        )
        bucket["shots"] += shots
        bucket["jobs"] += 1

    remaining = max(0, cap - used) if label == "today" else max(0, cap - used)
    # For multi-day windows, cap is still daily budget display; used is window aggregate (documented).
    dimension_note = (
        "Used shots sum approved workloads in the UTC window (estimated from metadata until job metering). "
        "Cap applies to the institution daily shot budget."
    )
    if label != "today":
        dimension_note += f" Window '{label}' aggregates consumption; daily cap shown for reference."

    return {
        "window": label,
        "window_start": start.isoformat(),
        "window_end": end.isoformat(),
        "daily_shots_cap": cap,
        "used_shots": used,
        "remaining_shots": remaining,
        "headroom_pct": _headroom_pct(cap, remaining),
        "warn_threshold_pct": warn,
        "used_shots_lifetime": lifetime_used,
        "entry_count": len(entries),
        "by_project": list(by_project.values()),
        "entries": entries,
        "policy_id": "tenant-daily-shots",
        "ledger_kind": "simulation_shots",
        "dimension": "shots",
        "dimension_note": dimension_note,
        "tenant_id": ctx.tenant_id,
    }


async def evaluate_workload(
    session: AsyncSession,
    ctx: TenantContext,
    *,
    workload_id: str,
) -> dict:
    authz.get().require(ctx, "quota:read", ResourceRef.tenant(ctx.tenant_id))
    if not is_ulid(workload_id):
        raise ValidationFailed(field_errors={"workload_id": "Invalid workload id."})
    row = (
        await session.execute(
            text(
                """
                SELECT w.workload_id, w.tenant_id, w.project_id, w.metadata
                FROM workload w WHERE w.workload_id = :w
                """
            ),
            {"w": workload_id},
        )
    ).mappings().first()
    if not row or row["tenant_id"] != ctx.tenant_id:
        raise ResourceNotFound()
    authz.get().require(
        ctx, "workload:read", ResourceRef.project(ctx.tenant_id, row["project_id"])
    )
    requested = _shots_from_metadata(row.get("metadata"))
    ledger = await get_ledger(session, ctx, window="today", project_id=None)
    remaining = int(ledger["remaining_shots"])
    allowed = requested <= remaining
    return {
        "workload_id": workload_id,
        "requested_shots": requested,
        "remaining_shots": remaining,
        "daily_shots_cap": ledger["daily_shots_cap"],
        "allowed": allowed,
        "reason_code": "OK" if allowed else "OVER_DAILY_CAP",
    }
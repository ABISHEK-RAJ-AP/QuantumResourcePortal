"""Meter rollups from approved workloads and provider jobs (honest derivations)."""

from __future__ import annotations

import csv
import io
from datetime import UTC, datetime, timedelta

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from qre.core import authz
from qre.core.context import ResourceRef, TenantContext
from qre.core.errors import ValidationFailed
from qre.services.svc05_quotas.service import _shots_from_metadata


def _parse_hours(raw: int) -> int:
    if raw not in (24, 72, 168):
        raise ValidationFailed(field_errors={"hours": "Supported windows: 24, 72, 168."})
    return raw


async def meter_rollups(
    session: AsyncSession, ctx: TenantContext, *, hours: int
) -> dict:
    authz.get().require(ctx, "usage:read", ResourceRef.tenant(ctx.tenant_id))
    window_h = _parse_hours(hours)
    since = datetime.now(UTC) - timedelta(hours=window_h)
    tid = ctx.tenant_id
    wl_rows = (
        await session.execute(
            text(
                """
                SELECT workload_id, metadata, updated_at
                FROM workload
                WHERE tenant_id = :t
                  AND governance_state = 'approved'
                  AND updated_at >= :since
                """
            ),
            {"t": tid, "since": since},
        )
    ).mappings().all()
    shot_sum = 0
    for row in wl_rows:
        shot_sum += _shots_from_metadata(row.get("metadata"))
    job_rows = (
        await session.execute(
            text(
                """
                SELECT status, count(*) AS n
                FROM provider_job
                WHERE tenant_id = :t AND submitted_at >= :since
                GROUP BY status
                """
            ),
            {"t": tid, "since": since},
        )
    ).mappings().all()
    jobs_by_status = {str(r["status"]): int(r["n"]) for r in job_rows}
    completed = jobs_by_status.get("COMPLETED", 0)
    failed = jobs_by_status.get("FAILED", 0)
    items = []
    sample_count = 0
    if wl_rows:
        items.append(
            {
                "dimension": "tenant",
                "metric": "approved_shots",
                "unit": "shots",
                "sum_value": shot_sum,
                "available_samples": len(wl_rows),
            }
        )
        sample_count += len(wl_rows)
    if completed or failed:
        items.append(
            {
                "dimension": "tenant",
                "metric": "provider_jobs_completed",
                "unit": "jobs",
                "sum_value": completed,
                "available_samples": completed,
            }
        )
        sample_count += completed
    if failed:
        items.append(
            {
                "dimension": "tenant",
                "metric": "provider_jobs_failed",
                "unit": "jobs",
                "sum_value": failed,
                "available_samples": failed,
            }
        )
        sample_count += failed
    return {
        "items": items,
        "since": since.isoformat(),
        "window_hours": window_h,
        "sample_count": sample_count,
    }


async def meter_rollups_csv(
    session: AsyncSession, ctx: TenantContext, *, hours: int
) -> str:
    authz.get().require(ctx, "report:export", ResourceRef.tenant(ctx.tenant_id))
    body = await meter_rollups(session, ctx, hours=hours)
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["dimension", "metric", "unit", "sum_value", "available_samples"])
    for row in body["items"]:
        writer.writerow(
            [
                row.get("dimension"),
                row.get("metric"),
                row.get("unit"),
                row.get("sum_value"),
                row.get("available_samples"),
            ]
        )
    return buf.getvalue()
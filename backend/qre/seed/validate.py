"""Post-seed integrity checks for demonstration data."""

from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.engine import Connection


class SeedValidationError(Exception):
    pass


def validate_demo_seed(conn: Connection, tenant_id: str) -> dict[str, int]:
    """Return entity counts and raise when core demo artefacts are missing."""

    def count(sql: str, **params) -> int:
        return int(conn.execute(text(sql), params).scalar() or 0)

    projects = count(
        "SELECT count(*) FROM project WHERE tenant_id = :t AND code LIKE 'DEMO-PRJ-%'",
        t=tenant_id,
    )
    backends = count(
        "SELECT count(*) FROM catalogue_backend WHERE tenant_id = :t AND backend_id LIKE 'demo-%'",
        t=tenant_id,
    )
    workloads = count("SELECT count(*) FROM workload WHERE tenant_id = :t", t=tenant_id)
    reservations = count(
        "SELECT count(*) FROM reservation WHERE tenant_id = :t AND purpose LIKE '[DEMO]%'",
        t=tenant_id,
    )
    jobs = count(
        "SELECT count(*) FROM provider_job WHERE tenant_id = :t AND job_id LIKE 'demo-job-%'",
        t=tenant_id,
    )
    attempts = count("SELECT count(*) FROM dispatch_attempt WHERE tenant_id = :t", t=tenant_id)
    incidents = count(
        "SELECT count(*) FROM ops_incident WHERE tenant_id = :t AND title LIKE '[DEMO]%'",
        t=tenant_id,
    )
    alerts = count(
        "SELECT count(*) FROM ops_alert WHERE tenant_id = :t AND title LIKE '[DEMO]%'",
        t=tenant_id,
    )

    errors: list[str] = []
    if projects < 8:
        errors.append(f"expected >= 8 demo projects, got {projects}")
    if backends < 10:
        errors.append(f"expected >= 10 demo backends, got {backends}")
    if workloads < 20:
        errors.append(f"expected >= 20 workloads, got {workloads}")
    if reservations < 15:
        errors.append(f"expected >= 15 demo reservations, got {reservations}")
    if jobs < 30:
        errors.append(f"expected >= 30 demo jobs, got {jobs}")
    if attempts < 20:
        errors.append(f"expected >= 20 dispatch attempts, got {attempts}")
    if incidents < 5:
        errors.append(f"expected >= 5 demo incidents, got {incidents}")
    if alerts < 8:
        errors.append(f"expected >= 8 demo alerts, got {alerts}")

    orphan_jobs = count(
        """
        SELECT count(*) FROM provider_job pj
        WHERE pj.tenant_id = :t AND pj.job_id LIKE 'demo-job-%'
          AND NOT EXISTS (
            SELECT 1 FROM dispatch_attempt da
            WHERE da.tenant_id = :t AND da.external_job_id = pj.job_id
          )
        """,
        t=tenant_id,
    )
    if orphan_jobs > 5:
        errors.append(f"too many jobs without dispatch_attempt link ({orphan_jobs})")

    if errors:
        raise SeedValidationError("; ".join(errors))

    return {
        "projects": projects,
        "backends": backends,
        "workloads": workloads,
        "reservations": reservations,
        "jobs": jobs,
        "dispatch_attempts": attempts,
        "incidents": incidents,
        "alerts": alerts,
    }

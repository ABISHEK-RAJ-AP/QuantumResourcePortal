"""Audit writer — append-only, hash-chained per tenant (LLD §4.18.1, §10.7, D-15).

Provisional scope for RBAC-3: enough to record role/membership changes and to let the
append-only trigger be exercised. The full search / verify API arrives in RBAC-5. The chain is
tenant-scoped; a serialising advisory lock (D-15) avoids two writers reading the same head.
Secret-looking keys in ``detail`` are masked before hashing and storage (LLD §10.8).
"""

from __future__ import annotations

import hashlib
import json
from typing import Any

from sqlalchemy import text
from sqlalchemy.engine import Connection

from qre.core.ids import new_ulid
from qre.core.logging import mask

GENESIS_HASH = "0" * 64


def _row_hash(prev_hash: str, fields: dict[str, Any]) -> str:
    payload = json.dumps({"prev": prev_hash, **fields}, sort_keys=True, default=str)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def write_audit(
    conn: Connection,
    *,
    tenant_id: str,
    action: str,
    actor_id: str | None,
    actor_type: str = "USER",
    outcome: str = "SUCCESS",
    target_type: str | None = None,
    target_id: str | None = None,
    detail: dict[str, Any] | None = None,
    correlation_id: str = "-",
    ip: str | None = None,
) -> str:
    """Append one hash-chained audit row for *tenant_id*. Returns the audit_id."""
    # Serialise chain writers for this tenant (advisory xact lock; released at commit).
    conn.execute(
        text("SELECT pg_advisory_xact_lock(hashtext('qre_audit:' || :t))"),
        {"t": tenant_id},
    )
    # now() is transaction-stable, so several rows in one transaction share occurred_at; the
    # monotonic ULID audit_id is the tiebreaker that keeps the chain order deterministic.
    prev = conn.execute(
        text(
            "SELECT row_hash FROM audit_log WHERE tenant_id = :t "
            "ORDER BY occurred_at DESC, audit_id DESC LIMIT 1"
        ),
        {"t": tenant_id},
    ).scalar()
    prev_hash = prev or GENESIS_HASH

    audit_id = new_ulid()
    safe_detail = mask(detail or {})
    fields = {
        "audit_id": audit_id,
        "tenant_id": tenant_id,
        "actor_id": actor_id,
        "actor_type": actor_type,
        "action": action,
        "target_type": target_type,
        "target_id": target_id,
        "outcome": outcome,
        "detail": safe_detail,
        "correlation_id": correlation_id,
    }
    row_hash = _row_hash(prev_hash, fields)

    conn.execute(
        text(
            """
            INSERT INTO audit_log (audit_id, tenant_id, actor_id, actor_type, action,
                                   target_type, target_id, outcome, detail, ip,
                                   correlation_id, prev_hash, row_hash)
            VALUES (:audit_id, :tenant_id, :actor_id, :actor_type, :action,
                    :target_type, :target_id, :outcome, CAST(:detail AS JSONB), CAST(:ip AS INET),
                    :correlation_id, :prev_hash, :row_hash)
            """
        ),
        {
            **{k: v for k, v in fields.items() if k != "detail"},
            "detail": json.dumps(safe_detail, default=str),
            "ip": ip,
            "prev_hash": prev_hash,
            "row_hash": row_hash,
        },
    )
    return audit_id


_LOCK_SQL = text("SELECT pg_advisory_xact_lock(hashtext('qre_audit:' || :t))")
_PREV_SQL = text(
    "SELECT row_hash FROM audit_log WHERE tenant_id = :t "
    "ORDER BY occurred_at DESC, audit_id DESC LIMIT 1"
)
_INSERT_SQL = text(
    """
    INSERT INTO audit_log (audit_id, tenant_id, actor_id, actor_type, action,
                           target_type, target_id, outcome, detail, ip,
                           correlation_id, prev_hash, row_hash)
    VALUES (:audit_id, :tenant_id, :actor_id, :actor_type, :action,
            :target_type, :target_id, :outcome, CAST(:detail AS JSONB), CAST(:ip AS INET),
            :correlation_id, :prev_hash, :row_hash)
    """
)


def _audit_row(prev_hash: str, *, tenant_id, action, actor_id, actor_type, outcome,
               target_type, target_id, detail, correlation_id, ip) -> dict[str, Any]:
    audit_id = new_ulid()
    safe_detail = mask(detail or {})
    fields = {
        "audit_id": audit_id, "tenant_id": tenant_id, "actor_id": actor_id,
        "actor_type": actor_type, "action": action, "target_type": target_type,
        "target_id": target_id, "outcome": outcome, "detail": safe_detail,
        "correlation_id": correlation_id,
    }
    row = dict(fields)
    row["detail"] = json.dumps(safe_detail, default=str)
    row["ip"] = ip
    row["prev_hash"] = prev_hash
    row["row_hash"] = _row_hash(prev_hash, fields)
    return row


async def write_audit_async(
    session: Any,  # AsyncSession
    *,
    tenant_id: str,
    action: str,
    actor_id: str | None,
    actor_type: str = "USER",
    outcome: str = "SUCCESS",
    target_type: str | None = None,
    target_id: str | None = None,
    detail: dict[str, Any] | None = None,
    correlation_id: str = "-",
    ip: str | None = None,
) -> str:
    """Async twin of :func:`write_audit` for request handlers using an AsyncSession."""
    await session.execute(_LOCK_SQL, {"t": tenant_id})
    prev = (await session.execute(_PREV_SQL, {"t": tenant_id})).scalar()
    row = _audit_row(
        prev or GENESIS_HASH, tenant_id=tenant_id, action=action, actor_id=actor_id,
        actor_type=actor_type, outcome=outcome, target_type=target_type, target_id=target_id,
        detail=detail, correlation_id=correlation_id, ip=ip,
    )
    await session.execute(_INSERT_SQL, row)
    return row["audit_id"]


def verify_chain(conn: Connection, tenant_id: str) -> bool:
    """Recompute the chain for *tenant_id* and confirm every link matches (TC-AUD-001)."""
    rows = conn.execute(
        text(
            """
            SELECT audit_id, tenant_id, actor_id, actor_type, action, target_type, target_id,
                   outcome, detail, correlation_id, prev_hash, row_hash
            FROM audit_log WHERE tenant_id = :t ORDER BY occurred_at ASC, audit_id ASC
            """
        ),
        {"t": tenant_id},
    ).mappings().all()
    prev = GENESIS_HASH
    for r in rows:
        if r["prev_hash"] != prev:
            return False
        # asyncpg returns JSONB as a raw string from an untyped text() query; parse so the hash
        # input matches the dict that write_audit hashed.
        detail = r["detail"]
        if isinstance(detail, str):
            detail = json.loads(detail)
        fields = {
            "audit_id": r["audit_id"],
            "tenant_id": r["tenant_id"],
            "actor_id": r["actor_id"],
            "actor_type": r["actor_type"],
            "action": r["action"],
            "target_type": r["target_type"],
            "target_id": r["target_id"],
            "outcome": r["outcome"],
            "detail": detail,
            "correlation_id": r["correlation_id"],
        }
        if _row_hash(prev, fields) != r["row_hash"]:
            return False
        prev = r["row_hash"]
    return True

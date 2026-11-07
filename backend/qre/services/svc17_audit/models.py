"""SQLAlchemy model for SVC-17 audit_log (LLD §4.18, Appendix B).

Append-only, hash-chained, partitioned by month. A database trigger (migration 0004) blocks
UPDATE/DELETE for the application role; the hash chain is written by
:mod:`qre.services.svc17_audit.service`. Mirrors the migration DDL; the schema test checks drift.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import CHAR, DateTime, String, func
from sqlalchemy.dialects.postgresql import INET, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from qre.core.db import Base

ULID = CHAR(26)


class AuditLog(Base):
    __tablename__ = "audit_log"
    # Composite PK (audit_id, occurred_at) because the table is RANGE-partitioned on occurred_at.
    audit_id: Mapped[str] = mapped_column(ULID, primary_key=True)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), primary_key=True, server_default=func.now()
    )
    tenant_id: Mapped[str] = mapped_column(ULID, nullable=False)
    actor_id: Mapped[str | None] = mapped_column(ULID)
    actor_type: Mapped[str] = mapped_column(String(8), nullable=False)
    action: Mapped[str] = mapped_column(String(48), nullable=False)
    target_type: Mapped[str | None] = mapped_column(String(32))
    target_id: Mapped[str | None] = mapped_column(String(64))
    outcome: Mapped[str] = mapped_column(String(12), nullable=False)
    detail: Mapped[dict] = mapped_column(JSONB, nullable=False, server_default="{}")
    ip: Mapped[str | None] = mapped_column(INET)
    correlation_id: Mapped[str] = mapped_column(String(64), nullable=False)
    prev_hash: Mapped[str] = mapped_column(CHAR(64), nullable=False)
    row_hash: Mapped[str] = mapped_column(CHAR(64), nullable=False)

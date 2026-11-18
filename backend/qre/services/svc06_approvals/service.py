"""Workload submissions, approval queue, and governance summary."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from qre.core import authz
from qre.core.context import ResourceRef, TenantContext
from qre.core.errors import Forbidden, InvalidStateTransition, ResourceNotFound, ValidationFailed
from qre.core.ids import is_ulid, new_ulid

DEFAULT_STAGES: list[dict[str, str]] = [
    {"id": "technical", "label": "Technical review"},
    {"id": "policy", "label": "Policy check"},
    {"id": "quota", "label": "Quota gate"},
]

OPEN_STATES = frozenset({"submitted_for_review", "in_review", "changes_requested"})
TERMINAL_STATES = frozenset({"approved", "rejected", "withdrawn"})

COUNT_KEYS = (
    "submitted_for_review",
    "in_review",
    "approved",
    "rejected",
    "withdrawn",
    "changes_requested",
)


async def _ensure_project(session: AsyncSession, ctx: TenantContext, project_id: str) -> dict:
    if not is_ulid(project_id):
        raise ValidationFailed(field_errors={"project_id": "Invalid project id."})
    row = (
        await session.execute(
            text(
                """
                SELECT project_id, tenant_id, submission_lock, is_archived
                FROM project WHERE project_id = :p
                """
            ),
            {"p": project_id},
        )
    ).mappings().first()
    if not row or row["tenant_id"] != ctx.tenant_id:
        raise ResourceNotFound()
    authz.get().require(ctx, "workload:read", ResourceRef.project(ctx.tenant_id, project_id))
    return dict(row)


async def _username(session: AsyncSession, user_id: str) -> str:
    row = (
        await session.execute(text("SELECT username FROM app_user WHERE user_id = :u"), {"u": user_id})
    ).scalar()
    return str(row) if row else user_id


def _progress_payload(stages: list[dict], stage_index: int) -> dict[str, Any]:
    idx = max(0, min(stage_index, max(len(stages) - 1, 0)))
    current = stages[idx] if stages else {"id": "review", "label": "Review"}
    return {
        "stages": stages,
        "stage_index": stage_index,
        "current_stage": current,
    }


def _workload_list_item(row: dict, created_by_name: str) -> dict:
    return {
        "workload_id": row["workload_id"],
        "project_id": row["project_id"],
        "governance_state": row["governance_state"],
        "created_by": created_by_name,
        "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
    }


def _workload_detail(row: dict, created_by_name: str, history: list) -> dict:
    stages = row.get("stages") or DEFAULT_STAGES
    if isinstance(stages, str):
        stages = json.loads(stages)
    if not isinstance(stages, list):
        stages = DEFAULT_STAGES
    stage_index = int(row.get("stage_index") or 0)
    if isinstance(history, str):
        history = json.loads(history)
    return {
        "workload_id": row["workload_id"],
        "project_id": row["project_id"],
        "submission_id": row["submission_id"],
        "governance_state": row["governance_state"],
        "metadata": row.get("metadata") or {},
        "created_by": created_by_name,
        "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
        "updated_at": row["updated_at"].isoformat() if row.get("updated_at") else None,
        "governance_progress": _progress_payload(stages, stage_index),
        "history": history if isinstance(history, list) else [],
    }


async def create_submission(
    session: AsyncSession,
    ctx: TenantContext,
    *,
    project_id: str,
    metadata: dict | None = None,
) -> dict:
    project = await _ensure_project(session, ctx, project_id)
    if project.get("is_archived"):
        raise InvalidStateTransition()
    if project.get("submission_lock"):
        raise InvalidStateTransition()
    authz.get().require(ctx, "workload:create", ResourceRef.project(ctx.tenant_id, project_id))
    sid = new_ulid()
    meta = metadata or {}
    await session.execute(
        text(
            """
            INSERT INTO workload_submission (
                submission_id, tenant_id, project_id, created_by, status, metadata
            ) VALUES (:id, :t, :p, :u, 'DRAFT', CAST(:m AS JSONB))
            """
        ),
        {"id": sid, "t": ctx.tenant_id, "p": project_id, "u": ctx.principal_id, "m": json.dumps(meta)},
    )
    return {"submission_id": sid, "project_id": project_id, "status": "draft", "metadata": meta}


async def submit_for_review(session: AsyncSession, ctx: TenantContext, submission_id: str) -> dict:
    if not is_ulid(submission_id):
        raise ValidationFailed(field_errors={"submission_id": "Invalid id."})
    row = (
        await session.execute(
            text(
                """
                SELECT s.submission_id, s.tenant_id, s.project_id, s.created_by, s.status, s.metadata
                FROM workload_submission s
                WHERE s.submission_id = :id
                """
            ),
            {"id": submission_id},
        )
    ).mappings().first()
    if not row or row["tenant_id"] != ctx.tenant_id:
        raise ResourceNotFound()
    if row["status"] != "DRAFT":
        raise InvalidStateTransition()
    authz.get().require(ctx, "workload:submit", ResourceRef.project(ctx.tenant_id, row["project_id"]))
    await _ensure_project(session, ctx, row["project_id"])
    wid = new_ulid()
    stages = DEFAULT_STAGES
    state = "submitted_for_review"
    await session.execute(
        text(
            """
            INSERT INTO workload (
                workload_id, tenant_id, project_id, submission_id, created_by,
                governance_state, metadata, stage_index, stages, history
            ) VALUES (
                :w, :t, :p, :s, :u, :st, CAST(:m AS JSONB), 0, CAST(:stages AS JSONB), '[]'::jsonb
            )
            """
        ),
        {
            "w": wid,
            "t": ctx.tenant_id,
            "p": row["project_id"],
            "s": submission_id,
            "u": row["created_by"],
            "st": state,
            "m": json.dumps(row["metadata"] or {}),
            "stages": json.dumps(stages),
        },
    )
    await session.execute(
        text(
            """
            UPDATE workload_submission
            SET status = 'SUBMITTED', updated_at = now()
            WHERE submission_id = :id
            """
        ),
        {"id": submission_id},
    )
    await session.execute(
        text("UPDATE project SET submission_lock = true, updated_at = now() WHERE project_id = :p"),
        {"p": row["project_id"]},
    )
    return {
        "submission_id": submission_id,
        "workload_id": wid,
        "project_id": row["project_id"],
        "governance_state": state,
    }


async def list_approvals(
    session: AsyncSession,
    ctx: TenantContext,
    *,
    project_id: str | None = None,
    state: str | None = None,
    scope: str | None = None,
) -> list[dict]:
    authz.get().require(ctx, "approval:read", ResourceRef.tenant(ctx.tenant_id))
    clauses = ["w.tenant_id = :t"]
    params: dict[str, Any] = {"t": ctx.tenant_id}
    if project_id:
        if not is_ulid(project_id):
            raise ValidationFailed(field_errors={"project_id": "Invalid project id."})
        clauses.append("w.project_id = :p")
        params["p"] = project_id
    if scope == "mine":
        clauses.append("w.created_by = :u")
        params["u"] = ctx.principal_id
    if state:
        clauses.append("w.governance_state = :st")
        params["st"] = state
    elif scope == "mine" or project_id:
        pass  # all states for "mine" or per-project hub
    else:
        placeholders = ", ".join(f"'{s}'" for s in OPEN_STATES)
        clauses.append(f"w.governance_state IN ({placeholders})")
    where = " AND ".join(clauses)
    rows = (
        await session.execute(
            text(
                f"""
                SELECT w.workload_id, w.project_id, w.governance_state, w.created_by, w.created_at
                FROM workload w
                WHERE {where}
                ORDER BY w.created_at DESC
                """
            ),
            params,
        )
    ).mappings().all()
    out: list[dict] = []
    for row in rows:
        name = await _username(session, row["created_by"])
        out.append(_workload_list_item(dict(row), name))
    return out


async def get_approval(session: AsyncSession, ctx: TenantContext, workload_id: str) -> dict:
    if not is_ulid(workload_id):
        raise ValidationFailed(field_errors={"workload_id": "Invalid workload id."})
    row = (
        await session.execute(
            text(
                """
                SELECT w.workload_id, w.tenant_id, w.project_id, w.submission_id, w.created_by,
                       w.governance_state, w.metadata, w.stage_index, w.stages, w.history,
                       w.created_at, w.updated_at
                FROM workload w
                WHERE w.workload_id = :id
                """
            ),
            {"id": workload_id},
        )
    ).mappings().first()
    if not row or row["tenant_id"] != ctx.tenant_id:
        raise ResourceNotFound()
    ref = ResourceRef.project(ctx.tenant_id, row["project_id"])
    if authz.get().can(ctx, "approval:read", ref):
        pass
    elif row["created_by"] == ctx.principal_id and authz.get().can(ctx, "workload:read", ref):
        pass
    else:
        authz.get().require(ctx, "approval:read", ref)
    name = await _username(session, row["created_by"])
    return _workload_detail(dict(row), name, row.get("history") or [])


async def decide(
    session: AsyncSession,
    ctx: TenantContext,
    workload_id: str,
    *,
    decision: str,
    comment: str,
    expected_stage_id: str | None = None,
) -> dict:
    if decision not in ("approve", "reject", "changes_requested"):
        raise ValidationFailed(field_errors={"decision": "Unsupported decision."})
    row = (
        await session.execute(
            text(
                """
                SELECT w.workload_id, w.tenant_id, w.project_id, w.created_by, w.governance_state,
                       w.stage_index, w.stages, w.history
                FROM workload w
                WHERE w.workload_id = :id
                """
            ),
            {"id": workload_id},
        )
    ).mappings().first()
    if not row or row["tenant_id"] != ctx.tenant_id:
        raise ResourceNotFound()
    if row["created_by"] == ctx.principal_id:
        raise Forbidden(detail="Submitters cannot approve their own workload.")
    authz.get().require(
        ctx,
        "approval:decide",
        ResourceRef.project(ctx.tenant_id, row["project_id"]),
    )
    if row["governance_state"] in TERMINAL_STATES:
        raise InvalidStateTransition()
    stages = row["stages"] or DEFAULT_STAGES
    if isinstance(stages, str):
        stages = json.loads(stages)
    stage_index = int(row["stage_index"] or 0)
    current = stages[stage_index] if stages else {"id": "review", "label": "Review"}
    if expected_stage_id and str(current.get("id")) != expected_stage_id:
        raise InvalidStateTransition()
    history = row["history"] or []
    if isinstance(history, str):
        history = json.loads(history)
    entry = {
        "action": decision,
        "actor_id": ctx.principal_id,
        "comment": comment,
        "stage_id": current.get("id"),
        "at": datetime.now(UTC).isoformat(),
    }
    history = list(history) + [entry]
    new_state = row["governance_state"]
    new_index = stage_index
    if decision == "approve":
        if stage_index + 1 >= len(stages):
            new_state = "approved"
        else:
            new_state = "in_review"
            new_index = stage_index + 1
    elif decision == "reject":
        new_state = "rejected"
    else:
        new_state = "changes_requested"
    await session.execute(
        text(
            """
            UPDATE workload
            SET governance_state = :st, stage_index = :idx, history = CAST(:h AS JSONB),
                updated_at = now()
            WHERE workload_id = :id
            """
        ),
        {"st": new_state, "idx": new_index, "h": json.dumps(history), "id": workload_id},
    )
    if new_state in TERMINAL_STATES:
        await _refresh_project_submission_lock(session, row["project_id"])
    from qre.services.svc17_audit.service import write_audit_async

    await write_audit_async(
        session,
        tenant_id=ctx.tenant_id,
        action=f"APPROVAL_{decision.upper()}",
        actor_id=ctx.principal_id,
        target_type="workload",
        target_id=workload_id,
        detail={"stage_id": current.get("id"), "new_state": new_state},
    )
    return await get_approval(session, ctx, workload_id)


async def _refresh_project_submission_lock(session: AsyncSession, project_id: str) -> None:
    open_list = ", ".join(f"'{s}'" for s in OPEN_STATES)
    await session.execute(
        text(
            f"""
            UPDATE project p
            SET submission_lock = EXISTS (
                SELECT 1 FROM workload w
                WHERE w.project_id = p.project_id
                  AND w.governance_state IN ({open_list})
            ),
            updated_at = now()
            WHERE p.project_id = :p
            """
        ),
        {"p": project_id},
    )


async def withdraw(session: AsyncSession, ctx: TenantContext, workload_id: str, *, comment: str) -> dict:
    row = (
        await session.execute(
            text(
                """
                SELECT w.workload_id, w.tenant_id, w.project_id, w.created_by, w.governance_state,
                       w.history
                FROM workload w
                WHERE w.workload_id = :id
                """
            ),
            {"id": workload_id},
        )
    ).mappings().first()
    if not row or row["tenant_id"] != ctx.tenant_id:
        raise ResourceNotFound()
    if row["created_by"] != ctx.principal_id:
        raise Forbidden(detail="Only the submitter can withdraw this workload.")
    authz.get().require(
        ctx,
        "workload:withdraw",
        ResourceRef.project(ctx.tenant_id, row["project_id"]),
    )
    if row["governance_state"] in TERMINAL_STATES:
        raise InvalidStateTransition()
    history = row["history"] or []
    if isinstance(history, str):
        history = json.loads(history)
    history = list(history) + [
        {
            "action": "withdraw",
            "actor_id": ctx.principal_id,
            "comment": comment,
            "at": datetime.now(UTC).isoformat(),
        }
    ]
    await session.execute(
        text(
            """
            UPDATE workload
            SET governance_state = 'withdrawn', history = CAST(:h AS JSONB), updated_at = now()
            WHERE workload_id = :id
            """
        ),
        {"h": json.dumps(history), "id": workload_id},
    )
    await _refresh_project_submission_lock(session, row["project_id"])
    return await get_approval(session, ctx, workload_id)


async def governance_summary(session: AsyncSession, ctx: TenantContext) -> dict:
    authz.get().require(ctx, "governance:read", ResourceRef.tenant(ctx.tenant_id))
    rows = (
        await session.execute(
            text(
                """
                SELECT governance_state, count(*) AS n
                FROM workload
                WHERE tenant_id = :t
                GROUP BY governance_state
                """
            ),
            {"t": ctx.tenant_id},
        )
    ).mappings().all()
    counts = {k: 0 for k in COUNT_KEYS}
    for row in rows:
        st = row["governance_state"]
        if st in counts:
            counts[st] = int(row["n"])
    queue = sum(counts.get(s, 0) for s in OPEN_STATES)
    in_review = counts.get("in_review", 0)
    asset_count = (
        await session.execute(
            text("SELECT count(*) FROM inventory_asset WHERE tenant_id = :t"),
            {"t": ctx.tenant_id},
        )
    ).scalar()
    return {
        "queue": queue,
        "in_review": in_review,
        "inventory_assets": int(asset_count or 0),
        "counts": {
            "submitted_for_review": counts.get("submitted_for_review", 0),
            "in_review": in_review,
            "approved": counts.get("approved", 0),
            "rejected": counts.get("rejected", 0),
            "withdrawn": counts.get("withdrawn", 0),
        },
    }
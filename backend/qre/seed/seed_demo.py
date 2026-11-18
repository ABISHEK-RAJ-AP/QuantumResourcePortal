"""Load interconnected QRP demonstration data into PostgreSQL (lab / development only)."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import text
from sqlalchemy.engine import Connection

from qre.core.config import Profile
from qre.core.ids import new_ulid
from qre.core.security import hash_password
from qre.seed.validate import SeedValidationError, validate_demo_seed
from qre.services.svc17_audit.service import write_audit

DEMO_SEED_VERSION = "2026.11.demo.v1"
DEMO_PASSWORD = "Demo-Strong-Pw-2026"
DEFAULT_STAGES = [
    {"id": "technical", "label": "Technical review"},
    {"id": "policy", "label": "Policy check"},
    {"id": "quota", "label": "Quota gate"},
]

PROJECT_SPECS = [
    ("DEMO-PRJ-0001", "Quantum Materials Simulation", "active", "Density-functional VQE benchmarks on superconducting QPUs."),
    ("DEMO-PRJ-0002", "Quantum Chemistry Benchmarking", "active", "Lithium hydride ground-state studies."),
    ("DEMO-PRJ-0003", "Quantum Error Correction Evaluation", "active", "Surface-code memory experiments."),
    ("DEMO-PRJ-0004", "Variational Quantum Algorithms", "active", "Hardware-aware ansatz compilation."),
    ("DEMO-PRJ-0005", "Quantum Optimisation Research", "pending", "MaxCut approximations with QAOA."),
    ("DEMO-PRJ-0006", "Quantum Machine Learning Experiments", "active", "Kernel methods on NISQ devices."),
    ("DEMO-PRJ-0007", "Quantum Circuit Compilation Study", "active", "Routing constraints on heavy-hex topology."),
    ("DEMO-PRJ-0008", "Quantum Hardware Characterisation", "active", "RB and T1 surveys across backends."),
    ("DEMO-PRJ-0009", "Near Expiry Allocation Study", "expiring", "Final allocation burn-down before renewal."),
    ("DEMO-PRJ-0010", "Completed Outreach Programme", "completed", "Archived teaching workloads."),
]

PROVIDER_SPECS = [
    ("demo-ibm", "IBM Quantum (demonstration)", "active", {"stage": "I3", "manifest_registered": True, "label": "DEMO — not production-connected"}),
    ("demo-ionq", "IonQ (demonstration)", "active", {"stage": "I2", "manifest_registered": False, "label": "configured-not-verified"}),
    ("demo-rigetti", "Rigetti (demonstration)", "suspended", {"stage": "I1", "manifest_registered": False, "label": "unavailable"}),
    ("demo-quantinuum", "Quantinuum (demonstration)", "active", {"stage": "I4", "manifest_registered": True, "label": "connected-test-adapter"}),
    ("demo-cdac-sim", "C-DAC local simulator", "active", {"stage": "I5", "manifest_registered": True, "label": "simulator"}),
    ("demo-institutional", "Institutional test simulator", "active", {"stage": "I5", "manifest_registered": True, "label": "demonstration-only"}),
]

BACKEND_TEMPLATE = [
    ("demo-ibm-torino", "demo-ibm", "ibm_torino", 133, "superconducting", "ONLINE", 1024, 100),
    ("demo-ibm-kyoto", "demo-ibm", "ibm_kyoto", 127, "superconducting", "ONLINE", 8192, 80),
    ("demo-ionq-forte", "demo-ionq", "ionq_forte", 36, "trapped_ion", "ONLINE", 4096, 60),
    ("demo-rigetti-aspen", "demo-rigetti", "aspen_m3", 79, "superconducting", "MAINTENANCE", 2048, 50),
    ("demo-quantinuum-h2", "demo-quantinuum", "h2", 56, "trapped_ion", "ONLINE", 8192, 40),
    ("demo-cdac-qsim32", "demo-cdac-sim", "qsim32", 32, "simulator", "ONLINE", 1_000_000, 999),
    ("demo-cdac-qsim64", "demo-cdac-sim", "qsim64", 64, "simulator", "ONLINE", 1_000_000, 999),
    ("demo-cdac-qsim128", "demo-cdac-sim", "qsim128", 128, "simulator", "ONLINE", 500_000, 999),
    ("demo-inst-qasm", "demo-institutional", "qasm_simulator", 40, "simulator", "ONLINE", 2_000_000, 999),
    ("demo-ibm-mumbai", "demo-ibm", "ibm_mumbai", 27, "superconducting", "OFFLINE", 4096, 30),
    ("demo-ionq-aria", "demo-ionq", "ionq_aria", 25, "trapped_ion", "ONLINE", 4096, 55),
    ("demo-quantinuum-h1", "demo-quantinuum", "h1", 20, "trapped_ion", "ONLINE", 4096, 35),
    ("demo-ibm-sherbrooke", "demo-ibm", "ibm_sherbrooke", 127, "superconducting", "ONLINE", 8192, 75),
    ("demo-cdac-noisy", "demo-cdac-sim", "noisy_density", 20, "simulator", "ONLINE", 500_000, 999),
    ("demo-inst-analog", "demo-institutional", "analog_demo", 8, "simulator", "ONLINE", 100_000, 999),
]

DEMO_USERS = [
    ("demo_researcher", "Demo Researcher", "RESEARCHER"),
    ("demo_pi", "Demo Principal Investigator", "PROJECT_OWNER"),
    ("demo_operator", "Demo Resource Operator", "OPERATOR"),
    ("demo_auditor", "Demo Auditor", "AUDITOR"),
]


class SeedDemoError(Exception):
    pass


@dataclass(frozen=True)
class SeedDemoResult:
    tenant_id: str
    tenant_code: str
    created: bool
    counts: dict[str, int]
    demo_users: list[str]


def _env_blocks_seed() -> None:
    profile = os.environ.get("QRE_ENV", "lab").lower()
    if profile == Profile.PRODUCTION.value:
        raise SeedDemoError("Refusing demo seed when QRE_ENV=production.")


def _resolve_tenant(conn: Connection, tenant_code: str) -> tuple[str, str]:
    row = conn.execute(
        text("SELECT tenant_id, code FROM tenant WHERE lower(code) = lower(:c)"),
        {"c": tenant_code.strip()},
    ).mappings().first()
    if not row:
        raise SeedDemoError(
            f"Tenant '{tenant_code}' not found — bootstrap first "
            f"(python -m qre bootstrap --tenant-code {tenant_code} ...)."
        )
    return str(row["tenant_id"]), str(row["code"])


def _seed_marker(conn: Connection, tenant_id: str) -> str | None:
    raw = conn.execute(text("SELECT settings FROM tenant WHERE tenant_id = :t"), {"t": tenant_id}).scalar()
    settings = raw if isinstance(raw, dict) else {}
    val = settings.get("demo_seed_version")
    return str(val) if val else None


def _set_seed_marker(conn: Connection, tenant_id: str) -> None:
    conn.execute(
        text(
            """
            UPDATE tenant
            SET settings = COALESCE(settings, '{}'::jsonb) || CAST(:patch AS JSONB),
                updated_at = now()
            WHERE tenant_id = :t
            """
        ),
        {
            "t": tenant_id,
            "patch": json.dumps(
                {
                    "demo_seed_version": DEMO_SEED_VERSION,
                    "daily_shots_cap": 50_000,
                    "warn_threshold_pct": 80,
                    "demo_data": True,
                }
            ),
        },
    )


def _role_id(conn: Connection, code: str) -> str:
    rid = conn.execute(text("SELECT role_id FROM role WHERE code = :c AND is_system"), {"c": code}).scalar()
    if not rid:
        raise SeedDemoError(f"System role {code} missing — run migrations.")
    return str(rid)


def _ensure_user(
    conn: Connection,
    *,
    tenant_id: str,
    username: str,
    display_name: str,
    password: str,
    actor_id: str,
) -> str:
    username = username.lower()
    existing = conn.execute(
        text("SELECT user_id FROM app_user WHERE username = :u"),
        {"u": username},
    ).scalar()
    if existing:
        return str(existing)
    uid = new_ulid()
    conn.execute(
        text(
            """
            INSERT INTO app_user (
                user_id, home_tenant_id, username, email, display_name, status, auth_mode, created_by
            ) VALUES (
                :id, :tid, :u, :email, :dn, 'ACTIVE', 'LOCAL', :actor
            )
            """
        ),
        {
            "id": uid,
            "tid": tenant_id,
            "u": username,
            "email": f"{username}@demo.qrp.local",
            "dn": f"[DEMO] {display_name}",
            "actor": actor_id,
        },
    )
    conn.execute(
        text("INSERT INTO user_credential (user_id, password_hash) VALUES (:id, :h)"),
        {"id": uid, "h": hash_password(password)},
    )
    return uid


def _grant_role(
    conn: Connection,
    *,
    tenant_id: str,
    user_id: str,
    role_code: str,
    scope_type: str,
    scope_id: str | None,
    granted_by: str,
) -> None:
    exists = conn.execute(
        text(
            """
            SELECT 1 FROM role_assignment
            WHERE tenant_id = :t AND principal_id = :u AND role = :role
              AND scope_type = :st AND COALESCE(scope_id, '') = COALESCE(:sid, '')
              AND revoked_at IS NULL
            """
        ),
        {"t": tenant_id, "u": user_id, "role": role_code, "st": scope_type, "sid": scope_id},
    ).scalar()
    if exists:
        return
    conn.execute(
        text(
            """
            INSERT INTO role_assignment (
                membership_id, tenant_id, principal_id, principal_type,
                role, role_id, scope_type, scope_id, granted_by
            ) VALUES (
                :mid, :t, :u, 'USER', :role, :rid, :st, :sid, :g
            )
            """
        ),
        {
            "mid": new_ulid(),
            "t": tenant_id,
            "u": user_id,
            "role": role_code,
            "rid": _role_id(conn, role_code),
            "st": scope_type,
            "sid": scope_id,
            "g": granted_by,
        },
    )


def seed_demo_reset(conn: Connection, *, tenant_code: str) -> dict[str, int]:
    _env_blocks_seed()
    tenant_id, _ = _resolve_tenant(conn, tenant_code)
    deleted: dict[str, int] = {}

    def wipe(label: str, sql: str) -> None:
        n = conn.execute(text(sql), {"t": tenant_id}).rowcount
        deleted[label] = int(n or 0)

    wipe(
        "dispatch_attempt",
        "DELETE FROM dispatch_attempt WHERE tenant_id = :t AND workload_id IN "
        "(SELECT workload_id FROM workload WHERE project_id IN "
        "(SELECT project_id FROM project WHERE tenant_id = :t AND code LIKE 'DEMO-PRJ-%'))",
    )
    wipe(
        "provider_job",
        "DELETE FROM provider_job WHERE tenant_id = :t AND job_id LIKE 'demo-job-%'",
    )
    wipe(
        "workload",
        "DELETE FROM workload WHERE tenant_id = :t AND project_id IN "
        "(SELECT project_id FROM project WHERE tenant_id = :t AND code LIKE 'DEMO-PRJ-%')",
    )
    wipe(
        "workload_submission",
        "DELETE FROM workload_submission WHERE tenant_id = :t AND project_id IN "
        "(SELECT project_id FROM project WHERE tenant_id = :t AND code LIKE 'DEMO-PRJ-%')",
    )
    wipe(
        "reservation",
        "DELETE FROM reservation WHERE tenant_id = :t AND purpose LIKE '[DEMO]%",
    )
    conn.execute(
        text(
            "UPDATE ops_alert SET incident_id = NULL WHERE tenant_id = :t AND title LIKE '[DEMO]%'"
        ),
        {"t": tenant_id},
    )
    wipe("ops_alert", "DELETE FROM ops_alert WHERE tenant_id = :t AND title LIKE '[DEMO]%'")
    wipe("ops_incident", "DELETE FROM ops_incident WHERE tenant_id = :t AND title LIKE '[DEMO]%'")
    wipe(
        "virtual_pool_member",
        "DELETE FROM virtual_pool_member WHERE pool_id IN "
        "(SELECT pool_id FROM virtual_pool WHERE tenant_id = :t AND name LIKE '[DEMO]%')",
    )
    wipe(
        "virtual_pool",
        "DELETE FROM virtual_pool WHERE tenant_id = :t AND name LIKE '[DEMO]%'",
    )
    wipe(
        "inventory_asset",
        "DELETE FROM inventory_asset WHERE tenant_id = :t AND native_asset_id LIKE 'demo-asset-%'",
    )
    wipe(
        "catalogue_backend",
        "DELETE FROM catalogue_backend WHERE tenant_id = :t AND backend_id LIKE 'demo-%'",
    )
    wipe(
        "catalogue_provider",
        "DELETE FROM catalogue_provider WHERE tenant_id = :t AND provider_id LIKE 'demo-%'",
    )
    wipe(
        "role_assignment",
        "DELETE FROM role_assignment WHERE tenant_id = :t AND principal_id IN "
        "(SELECT user_id FROM app_user WHERE username LIKE 'demo_%')",
    )
    wipe(
        "project",
        "DELETE FROM project WHERE tenant_id = :t AND code LIKE 'DEMO-PRJ-%'",
    )
    conn.execute(
        text(
            """
            UPDATE tenant
            SET settings = settings - 'demo_seed_version' - 'demo_data'
            WHERE tenant_id = :t
            """
        ),
        {"t": tenant_id},
    )
    return deleted


def seed_demo(
    conn: Connection,
    *,
    tenant_code: str,
    force: bool = False,
    skip_validate: bool = False,
) -> SeedDemoResult:
    """Insert demonstration entities for *tenant_code* (idempotent per DEMO_SEED_VERSION)."""

    _env_blocks_seed()
    tenant_id, code = _resolve_tenant(conn, tenant_code)

    marker = _seed_marker(conn, tenant_id)
    if marker == DEMO_SEED_VERSION and not force:
        counts = validate_demo_seed(conn, tenant_id) if not skip_validate else {}
        return SeedDemoResult(tenant_id, code, False, counts, [u[0] for u in DEMO_USERS])

    if force:
        seed_demo_reset(conn, tenant_code=tenant_code)

    admin_id = conn.execute(
        text(
            """
            SELECT u.user_id FROM app_user u
            JOIN role_assignment ra ON ra.principal_id = u.user_id
            WHERE ra.tenant_id = :t AND ra.role = 'PLATFORM_ADMIN'
              AND ra.scope_type = 'TENANT' AND ra.revoked_at IS NULL
            ORDER BY u.created_at
            LIMIT 1
            """
        ),
        {"t": tenant_id},
    ).scalar()
    if not admin_id:
        raise SeedDemoError("No PLATFORM_ADMIN found for tenant — bootstrap required.")
    admin_id = str(admin_id)

    user_ids: dict[str, str] = {}
    for username, display, _role in DEMO_USERS:
        user_ids[username] = _ensure_user(
            conn,
            tenant_id=tenant_id,
            username=username,
            display_name=display,
            password=DEMO_PASSWORD,
            actor_id=admin_id,
        )

    for username, _, role in DEMO_USERS:
        if role in ("OPERATOR", "AUDITOR"):
            _grant_role(
                conn,
                tenant_id=tenant_id,
                user_id=user_ids[username],
                role_code=role,
                scope_type="TENANT",
                scope_id=None,
                granted_by=admin_id,
            )

    now = datetime.now(UTC)
    project_ids: dict[str, str] = {}

    for proj_code, name, flavour, description in PROJECT_SPECS:
        existing = conn.execute(
            text("SELECT project_id FROM project WHERE tenant_id = :t AND code = :c"),
            {"t": tenant_id, "c": proj_code},
        ).scalar()
        if existing:
            project_ids[proj_code] = str(existing)
            continue
        pid = new_ulid()
        status = "ACTIVE"
        archived = flavour == "completed"
        conn.execute(
            text(
                """
                INSERT INTO project (
                    project_id, tenant_id, code, name, status, description, project_type,
                    is_archived, submission_lock, created_by
                ) VALUES (
                    :p, :t, :c, :n, :st, :desc, 'quantum_circuit', :arch, false, :cb
                )
                """
            ),
            {
                "p": pid,
                "t": tenant_id,
                "c": proj_code,
                "n": f"[DEMO] {name}",
                "st": status,
                "desc": description,
                "arch": archived,
                "cb": user_ids["demo_pi"],
            },
        )
        project_ids[proj_code] = pid
        _grant_role(
            conn,
            tenant_id=tenant_id,
            user_id=user_ids["demo_pi"],
            role_code="PROJECT_OWNER",
            scope_type="PROJECT",
            scope_id=pid,
            granted_by=admin_id,
        )
        _grant_role(
            conn,
            tenant_id=tenant_id,
            user_id=user_ids["demo_researcher"],
            role_code="RESEARCHER",
            scope_type="PROJECT",
            scope_id=pid,
            granted_by=admin_id,
        )
        write_audit(
            conn,
            tenant_id=tenant_id,
            action="PROJECT_CREATED",
            actor_id=admin_id,
            target_type="project",
            target_id=pid,
            detail={"code": proj_code, "demo": True},
            correlation_id="demo-seed",
        )

    for prov_id, name, status, integration in PROVIDER_SPECS:
        exists = conn.execute(
            text(
                "SELECT 1 FROM catalogue_provider WHERE tenant_id = :t AND provider_id = :p"
            ),
            {"t": tenant_id, "p": prov_id},
        ).scalar()
        if exists:
            continue
        conn.execute(
            text(
                """
                INSERT INTO catalogue_provider (
                    tenant_id, provider_id, provider_name, status, integration, created_by
                ) VALUES (:t, :pid, :name, :st, CAST(:integ AS JSONB), :admin)
                """
            ),
            {
                "t": tenant_id,
                "pid": prov_id,
                "name": f"[DEMO] {name}",
                "st": status,
                "integ": json.dumps(integration),
                "admin": admin_id,
            },
        )

    for (
        backend_id,
        provider_id,
        backend_name,
        qubits,
        modality,
        op_status,
        max_shots,
        queue_depth,
    ) in BACKEND_TEMPLATE:
        exists = conn.execute(
            text(
                "SELECT 1 FROM catalogue_backend WHERE tenant_id = :t AND backend_id = :b"
            ),
            {"t": tenant_id, "b": backend_id},
        ).scalar()
        if exists:
            continue
        queue = {
            "pending_jobs": queue_depth,
            "queue_condition": "busy" if queue_depth > 50 else "idle",
            "trend": "up" if queue_depth > 60 else "flat",
        }
        conn.execute(
            text(
                """
                INSERT INTO catalogue_backend (
                    tenant_id, backend_id, provider_id, backend_name, operational_status,
                    qubit_count, qpu_modality, topology_type, queue_snapshot
                ) VALUES (
                    :t, :bid, :pid, :name, :status, :q, :mod, 'heavy_hex',
                    CAST(:queue AS JSONB)
                )
                """
            ),
            {
                "t": tenant_id,
                "bid": backend_id,
                "pid": provider_id,
                "name": f"[DEMO] {backend_name}",
                "status": op_status,
                "q": qubits,
                "mod": modality,
                "queue": json.dumps(queue),
            },
        )

    asset_ids: list[str] = []
    for idx, (backend_id, provider_id, _, _, modality, _, _, _) in enumerate(BACKEND_TEMPLATE[:8]):
        native = f"demo-asset-{idx + 1:02d}"
        exists = conn.execute(
            text(
                """
                SELECT asset_id FROM inventory_asset
                WHERE tenant_id = :t AND provider_id = :p AND native_asset_id = :n
                """
            ),
            {"t": tenant_id, "p": provider_id, "n": native},
        ).scalar()
        if exists:
            asset_ids.append(str(exists))
            continue
        aid = new_ulid()
        exec_cls = "simulated" if modality == "simulator" else "hardware"
        lifecycle = "maintenance" if "rigetti" in backend_id else "active"
        conn.execute(
            text(
                """
                INSERT INTO inventory_asset (
                    asset_id, tenant_id, provider_id, native_asset_id,
                    asset_class, execution_class, lifecycle_state, created_by
                ) VALUES (
                    :id, :t, :p, :n, :cls, :exec, :life, :admin
                )
                """
            ),
            {
                "id": aid,
                "t": tenant_id,
                "p": provider_id,
                "n": native,
                "cls": "Simulator" if exec_cls == "simulated" else "QPU",
                "exec": exec_cls,
                "life": lifecycle,
                "admin": admin_id,
            },
        )
        asset_ids.append(aid)

    pool_id = conn.execute(
        text("SELECT pool_id FROM virtual_pool WHERE tenant_id = :t AND name = :n"),
        {"t": tenant_id, "n": "[DEMO] Superconducting pool"},
    ).scalar()
    if not pool_id:
        pool_id = new_ulid()
        conn.execute(
            text(
                """
                INSERT INTO virtual_pool (pool_id, tenant_id, name, description, created_by)
                VALUES (:id, :t, :name, :desc, :admin)
                """
            ),
            {
                "id": pool_id,
                "t": tenant_id,
                "name": "[DEMO] Superconducting pool",
                "desc": "Eligible superconducting QPU assets for production workloads.",
                "admin": admin_id,
            },
        )
    pool_id = str(pool_id)
    for aid in asset_ids[:4]:
        conn.execute(
            text(
                """
                INSERT INTO virtual_pool_member (pool_id, tenant_id, asset_id)
                VALUES (:p, :t, :a)
                ON CONFLICT DO NOTHING
                """
            ),
            {"p": pool_id, "t": tenant_id, "a": aid},
        )

    states_cycle = [
        "submitted_for_review",
        "in_review",
        "changes_requested",
        "approved",
        "approved",
        "approved",
        "rejected",
        "approved",
    ]
    workload_records: list[dict[str, Any]] = []
    hero_workload_id: str | None = None

    for i in range(25):
        proj_code = PROJECT_SPECS[i % len(PROJECT_SPECS)][0]
        pid = project_ids[proj_code]
        sid = new_ulid()
        wid = new_ulid()
        state = states_cycle[i % len(states_cycle)]
        stage_index = 3 if state == "approved" else (1 if state == "in_review" else 0)
        shots = 500 + (i * 37) % 4000
        qubits = 8 + (i % 12)
        meta = {
            "purpose": f"Variational circuit benchmark #{i + 1}",
            "shots": shots,
            "qubits": qubits,
            "depth": 40 + i,
            "circuit": "demo_vqe_ansatz",
            "backend_hint": BACKEND_TEMPLATE[i % len(BACKEND_TEMPLATE)][0],
            "demo_scenario": (i % 8) + 1,
        }
        history: list[dict[str, Any]] = []
        if state == "approved":
            for stage in DEFAULT_STAGES:
                history.append(
                    {
                        "action": "approve",
                        "actor_id": admin_id,
                        "comment": f"Demo approval — {stage['label']}",
                        "stage_id": stage["id"],
                        "at": (now - timedelta(days=3, hours=i)).isoformat(),
                    }
                )
        elif state == "rejected":
            history.append(
                {
                    "action": "reject",
                    "actor_id": admin_id,
                    "comment": "Quota policy — insufficient justification",
                    "stage_id": "policy",
                    "at": (now - timedelta(hours=12)).isoformat(),
                }
            )
        created_at = now - timedelta(days=7 - (i % 7), hours=i)
        conn.execute(
            text(
                """
                INSERT INTO workload_submission (
                    submission_id, tenant_id, project_id, created_by, status, metadata, created_at
                ) VALUES (
                    :s, :t, :p, :u, 'SUBMITTED', CAST(:m AS JSONB), :at
                )
                ON CONFLICT DO NOTHING
                """
            ),
            {
                "s": sid,
                "t": tenant_id,
                "p": pid,
                "u": user_ids["demo_researcher"],
                "m": json.dumps(meta),
                "at": created_at,
            },
        )
        exists_w = conn.execute(
            text("SELECT workload_id FROM workload WHERE submission_id = :s"),
            {"s": sid},
        ).scalar()
        if exists_w:
            workload_records.append({"workload_id": str(exists_w), "meta": meta, "state": state})
            continue

        conn.execute(
            text(
                """
                INSERT INTO workload (
                    workload_id, tenant_id, project_id, submission_id, created_by,
                    governance_state, metadata, stage_index, stages, history, created_at, updated_at
                ) VALUES (
                    :w, :t, :p, :s, :u, :st, CAST(:m AS JSONB), :idx,
                    CAST(:stages AS JSONB), CAST(:hist AS JSONB), :cat, :uat
                )
                """
            ),
            {
                "w": wid,
                "t": tenant_id,
                "p": pid,
                "s": sid,
                "u": user_ids["demo_researcher"],
                "st": state,
                "m": json.dumps(meta),
                "idx": stage_index,
                "stages": json.dumps(DEFAULT_STAGES),
                "hist": json.dumps(history),
                "cat": created_at,
                "uat": created_at + timedelta(hours=2),
            },
        )
        workload_records.append({"workload_id": wid, "meta": meta, "state": state})
        if proj_code == "DEMO-PRJ-0001" and i == 0:
            hero_workload_id = wid
        write_audit(
            conn,
            tenant_id=tenant_id,
            action="WORKLOAD_SUBMITTED",
            actor_id=user_ids["demo_researcher"],
            target_type="workload",
            target_id=wid,
            detail={"project_code": proj_code, "demo": True},
            correlation_id="demo-seed",
        )

    reservation_states = ["requested", "active", "released", "cancelled", "active", "requested"]
    for i in range(20):
        proj_code = PROJECT_SPECS[i % len(PROJECT_SPECS)][0]
        backend_id = BACKEND_TEMPLATE[i % len(BACKEND_TEMPLATE)][0]
        start = now + timedelta(days=(i % 14) - 3, hours=10)
        end = start + timedelta(hours=2)
        st = reservation_states[i % len(reservation_states)]
        conn.execute(
            text(
                """
                INSERT INTO reservation (
                    reservation_id, tenant_id, project_id, resource_ref, purpose,
                    window_start, window_end, state, created_by
                ) VALUES (
                    :id, :t, :p, :ref, :purpose, :ws, :we, :st, :u
                )
                ON CONFLICT DO NOTHING
                """
            ),
            {
                "id": new_ulid(),
                "t": tenant_id,
                "p": project_ids[proj_code],
                "ref": backend_id,
                "purpose": f"[DEMO] Reservation window {i + 1} — {st}",
                "ws": start,
                "we": end,
                "st": st,
                "u": user_ids["demo_operator"],
            },
        )

    job_statuses = ["QUEUED", "RUNNING", "COMPLETED", "FAILED", "COMPLETED"]
    dispatch_states = [
        "dispatch_confirmed",
        "dispatch_confirmed",
        "dispatch_failed",
        "dispatch_unresolved",
        "dispatch_confirmed",
    ]
    for i in range(40):
        wl = workload_records[i % len(workload_records)]
        if wl["state"] != "approved" and i % 3 != 0:
            continue
        wid = wl["workload_id"]
        backend_id = str(wl["meta"].get("backend_hint", BACKEND_TEMPLATE[0][0]))
        attempt_id = new_ulid()
        job_id = f"demo-job-{i + 1:04d}"
        ext_state = dispatch_states[i % len(dispatch_states)]
        submitted_at = now - timedelta(hours=i + 1)
        conn.execute(
            text(
                """
                INSERT INTO dispatch_attempt (
                    attempt_id, tenant_id, workload_id, backend_id, execution_class,
                    dispatch_state, external_job_id, provider_ref, created_at, updated_at
                ) VALUES (
                    :a, :t, :w, :b, :exec, :st, :job, :pref, :cat, :uat
                )
                ON CONFLICT DO NOTHING
                """
            ),
            {
                "a": attempt_id,
                "t": tenant_id,
                "w": wid,
                "b": backend_id,
                "exec": "simulated" if "sim" in backend_id else "hardware",
                "st": ext_state,
                "job": job_id,
                "pref": f"provider-ref-{i + 1}",
                "cat": submitted_at,
                "uat": submitted_at + timedelta(minutes=30),
            },
        )
        jstatus = job_statuses[i % len(job_statuses)]
        if ext_state == "dispatch_failed":
            jstatus = "FAILED"
        conn.execute(
            text(
                """
                INSERT INTO provider_job (
                    tenant_id, job_id, backend_id, status, runtime, failure_reason,
                    submitted_at, updated_at, timeline
                ) VALUES (
                    :t, :jid, :b, :st, :rt, :fail, :sat, :uat, CAST(:tl AS JSONB)
                )
                ON CONFLICT DO NOTHING
                """
            ),
            {
                "t": tenant_id,
                "jid": job_id,
                "b": backend_id,
                "st": jstatus,
                "rt": "qasm3" if i % 2 == 0 else "qiskit",
                "fail": "Provider timeout (demo)" if jstatus == "FAILED" else None,
                "sat": submitted_at,
                "uat": submitted_at + timedelta(minutes=20),
                "tl": json.dumps(
                    [
                        {"state": "QUEUED", "at": submitted_at.isoformat()},
                        {"state": jstatus, "at": (submitted_at + timedelta(minutes=15)).isoformat()},
                    ]
                ),
            },
        )

    incident_id = new_ulid()
    conn.execute(
        text(
            """
            INSERT INTO ops_incident (
                incident_id, tenant_id, title, summary, status, severity, backend_id, owner
            ) VALUES (
                :id, :t, :title, :sum, 'INVESTIGATING', 'WARNING', :b, 'demo_operator'
            )
            ON CONFLICT DO NOTHING
            """
        ),
        {
            "id": incident_id,
            "t": tenant_id,
            "title": "[DEMO] Queue congestion on demo-ibm-torino",
            "sum": "Elevated pending_jobs snapshot — demonstration only.",
            "b": "demo-ibm-torino",
        },
    )

    alert_specs = [
        ("CRITICAL", "ACTIVE", "Calibration staleness", "demo-quantinuum-h2"),
        ("WARNING", "ACTIVE", "Quota threshold warning", None),
        ("INFO", "ACKNOWLEDGED", "Provider degradation", "demo-ionq"),
    ]
    for severity, status, title, backend in alert_specs:
        conn.execute(
            text(
                """
                INSERT INTO ops_alert (
                    alert_id, tenant_id, backend_id, incident_id, severity, status,
                    title, message, current_value, threshold_value
                ) VALUES (
                    :id, :t, :b, :inc, :sev, :st, :title, :msg, :cur, :thr
                )
                ON CONFLICT DO NOTHING
                """
            ),
            {
                "id": new_ulid(),
                "t": tenant_id,
                "b": backend,
                "inc": incident_id if "congestion" in title.lower() else None,
                "sev": severity,
                "st": status,
                "title": f"[DEMO] {title}",
                "msg": "Demonstration alert — not live provider telemetry.",
                "cur": 87,
                "thr": 80,
            },
        )

    if hero_workload_id:
        write_audit(
            conn,
            tenant_id=tenant_id,
            action="DISPATCH_CONFIRMED",
            actor_id=user_ids["demo_operator"],
            target_type="workload",
            target_id=hero_workload_id,
            detail={"scenario": "successful_quantum_execution", "demo": True},
            correlation_id="demo-seed",
        )

    _set_seed_marker(conn, tenant_id)

    try:
        counts = validate_demo_seed(conn, tenant_id)
    except SeedValidationError as exc:
        if skip_validate:
            counts = {}
        else:
            raise SeedDemoError(str(exc)) from exc

    return SeedDemoResult(
        tenant_id=tenant_id,
        tenant_code=code,
        created=True,
        counts=counts,
        demo_users=[u[0] for u in DEMO_USERS],
    )
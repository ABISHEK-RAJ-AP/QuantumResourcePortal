# QRP reconstruction — spirit doc (committed)

**One page the repo keeps.** Deep reference research, vendor clones, and per-repo stubs stay **on disk only** — see §Local-only below. Agents read this first, then code and `FULL_STACK_STATUS.md`.

## Mission

Build a **complete quantum resource management platform** (governance → capacity → execution → accounting), not a skin job. Extract **information architecture, workflows, state machines, APIs, and data models** from mature references; implement as **native QRP** under existing React 19 + FastAPI + PostgreSQL + RBAC.

## Non-negotiables

| Do | Do not |
| --- | --- |
| End-to-end slices: migration → service → guarded route → integration test → honest UI states | List pages that 404 or lab-stub without documenting gap |
| `require_permission` / `get_ctx` + resource-scoped checks in services | Frontend-only auth or invented KPIs |
| Contextual workflow steps (detail, wizards) | Global governance rail on every hub |
| Pattern + field semantics from references | Copy AGPL/GPL source into `frontend/` or `backend/qre/` |
| Commit product truth: APIs, migrations, tests, `FULL_STACK_STATUS.md` | Commit `vendor-references/`, `docs/reference-analysis/`, vendor inventory markdown |

## Local-only (never push)

```text
vendor-references/          # cloned upstream repos — read-only research
docs/reference-analysis/    # inventories, matrices, stubs, IMPLEMENTATION_LOG (optional local)
docs/research/VENDOR_REFERENCE_UI.md
```

Optional local clone helper: `vendor-references/clone-all.sh` (not in git). Regenerate analysis on your machine; do not treat missing clones as blockers for **implemented** QRP code.

## Reference → QRP map (patterns, not products)

| Capability | Study (local clone) | QRP surface |
| --- | --- | --- |
| Projects, allocations, approvals | ColdFront | `/qrp/projects`, workloads, approvals |
| Holds, leases, conflicts | Blazar, LibreBooking | `/qrp/reservations`, scheduling |
| Job composer, queues | OnDemand, CodeFlare, qBraid | workloads, jobs, dispatch |
| Utilisation, accounting | XDMoD | home, quotas, metering |
| Ops inventory | Horizon (docs if not cloned) | inventory, providers, backends |
| Workflow graph, retries | Argo | job detail, dispatch attempts |
| Approvals, audit tone | CompanyOS (patterns only) | approval detail, governance audit |

Investigation method: **route → handler → model/migration → tests**, not README tourism.

## Phase 1–2 (your master prompt)

| Phase | Deliverable | Git |
| --- | --- | --- |
| **1 Discovery** | Baseline assessment, repo inventory, screen↔API map | **Local** `docs/reference-analysis/` |
| **2 Decisions** | Capability matrix, form catalogue, decision log | **Local** `docs/reference-analysis/` |
| **2 (committed)** | API matrix, E2E workflow, UI reconstruction plan | **`docs/product/QRP_*`** |

Read order: **spirit → `QRP_API_IMPLEMENTATION_MATRIX.md` → `FULL_STACK_STATUS.md` → `QRP_UI_RECONSTRUCTION_PLAN.md`**.  
Do **not** rewrite all screens until Phase 2 matrices reflect code truth (committed product docs are updated; deepen locally as you clone vendors).

## Baseline before building

1. Trace `Page → qre() → router → service → DB` for the module.
2. Classify each path in `docs/product/FULL_STACK_STATUS.md` and `QRP_API_IMPLEMENTATION_MATRIX.md`: **shipped** | **lab stub** | **missing**.
3. Match `permissions.yaml` and `frontend` validation schemas to API bodies.

## Implementation order (dependencies)

| Priority | Modules | Why |
| --- | --- | --- |
| **P0** | Projects, members, workload submit, approvals, quota ledger | Governance foundation |
| **P1** | Providers, backends, inventory/pools, reservations (done: svc07), scheduling UI | Discoverable quantum capacity |
| **P1** | Jobs, dispatch attempts, provider adapter boundary | Real execution path |
| **P2** | Metering, reconciliation, governance audit (≠ RBAC audit), evidence | Accountability |
| **P2** | Home, Operations Centre | Only after KPIs have real queries |

Current shipped backend slices (verify in repo): identity/admin, projects + **members** (svc03), approvals/workloads (svc06), reservations (svc07), rbac audit (svc17). Lab router: partial ops KPIs only when `QRE_ENV=lab`.

## Lifecycle (do not collapse stages)

`Project → workload → review → authorise → quota → reservation → schedule → dispatch → provider job → results → metering → reconcile → evidence`

Each stage: permission, precondition, validation, DB write, audit, allowed transitions **in the service layer**.

## Module definition of done

- Router guarded; integration test or documented skip reason
- UI: real empty/error; mutations invalidate correct query keys
- `FULL_STACK_STATUS.md` row updated
- No new npm/backend deps without need (ponytail)

## Agent workflow

1. Read this file + `FULL_STACK_STATUS.md` + touched module in `WORKSPACE_UI_CATALOG.md`.
2. If researching a reference, work under `vendor-references/` locally; **no git adds** there or under `docs/reference-analysis/`.
3. Ship smallest vertical slice; run `pytest` / `make verify-stack` when DB available.
4. User-facing docs: product folder only; no sprawl of research markdown in commits.

## UX law (from shipped QRP decisions)

- Breadcrumbs on hubs; step rails on approval detail, asset lifecycle, wizards in modals.
- Tables: search/filter/pagination when dataset is server-backed; honest conflict and quota display.
- Quantum fields only when they drive compatibility, quota, or dispatch — else derive from circuit/backend selection.

## Definition of “complete product”

Researchers can submit governed workloads; approvers decide with audit; operators see real capacity, reservations, and job/dispatch state; accountants see quota/usage with defined units; auditors can trace correlation IDs across stages. Anything else is labelled **stub**, **lab**, or **not implemented** in `FULL_STACK_STATUS.md`.
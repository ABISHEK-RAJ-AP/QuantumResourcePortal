# Vendor reference UI — QRP lifecycle vs open-source patterns

**Purpose:** No single OSS quantum repo implements the full QRE lifecycle (project → approve → quota → reserve → dispatch → reconcile → audit). QRP composes **HPC/cloud governance UIs** with **quantum orchestration** patterns. This doc maps each QRP surface to reference projects and clone paths under `vendor-references/`.

**QRP stack (this repo):** React 19 + Vite + TanStack Query · FastAPI + PostgreSQL + Redis · national-lab style RBAC (not multi-tenant SaaS marketing chrome).

---

## Lifecycle → reference matrix

| QRP step | QRP routes / components | Primary OSS reference | What to steal (UI + API shape) |
| --- | --- | --- | --- |
| **Submit** — project + workload package | `ProjectsPage`, `ProjectCreateWizard`, `WorkloadSubmitWizard`, `ProjectDetailPage` | [ColdFront](https://github.com/coldfront/coldfront) | PI projects, allocation requests, collaborator membership, request metadata forms |
| **Review / Authorise** — staged decisions | `ApprovalsPage`, `ApprovalDetailPage`, `WorkflowSteps` on detail | ColdFront admin / request views | Multi-step review queue, approver comments, eligibility checks |
| **Quota** — ledger & evaluate | `QuotasPage`, approval quota panel | ColdFront allocations + [Open XDMoD](https://github.com/ubccr/xdmod) | Allocation limits, usage vs cap, project-scoped ledgers |
| **Schedule hold** — capacity window | `ReservationsPage`, `SchedulingPage`, `ReservationCalendar` | [OpenStack Blazar](https://github.com/openstack/blazar), [FTQMP-Scheduler](https://github.com/team-QMP/FTQMP-Scheduler) | Lease timeline, conflict detection, lease state machine, QPU packing visualizer |
| **Dispatch** — provider attempts | `DispatchPage`, `JobsPage`, `ReconciliationPage` | [Open OnDemand](https://github.com/OSC/ondemand), [qBraid](https://github.com/qbraid/qbraid) | Job composer, queue status, multi-backend picker, job state badges |
| **Reconcile** — reserved vs consumed | `ReconciliationPage`, `MeteringPage` | Open XDMoD, [Argo Workflows](https://github.com/argoproj/argo-workflows) UI patterns | Wall-time vs reserved time, shot accounting, workflow step outcomes |
| **Evidence / Audit** | `AuditPage`, `/rbac/audit` API | Open XDMoD reports + QRP append-only `audit_log` | Immutable event stream, export, auditor dashboards |

---

## Screen blueprint (your 5-view model → QRP)

### 1. Project & quota request (ColdFront)

| Reference screen | QRP equivalent | Fields / actions to align |
| --- | --- | --- |
| Project + allocation request | Project hub + submit wizard | `purpose`, `resource_hint`, project type, members, funding metadata (future) |
| Collaborators / PI | `ProjectDetailPage` → Members tab | editor/viewer roles → map to `projectMemberSchema` |

### 2. Review & approval queue (ColdFront admin)

| Reference | QRP equivalent |
| --- | --- |
| Request list + filters | `ApprovalsPage` `FilterBar`, state chart |
| Single request + stages | `ApprovalDetailPage` + contextual `WorkflowSteps` |
| Decision + rationale | `approvalDecisionSchema`, audit write |

### 3. Capacity reservation calendar (Blazar + FTQMP)

| Reference | QRP equivalent |
| --- | --- |
| Lease calendar | `ReservationCalendar`, `ReservationsPage` |
| Conflict / transition | `reservationHoldSchema`, transition POST |
| Spatial schedule viz | FTQMP layout ideas → future ops chart on `CentrePage` |

### 4. Job dispatch & multi-backend (OnDemand + qBraid)

| Reference | QRP equivalent |
| --- | --- |
| Job composer / script panel | Project submit + future job detail |
| Queue / HPC apps | `JobsPage`, `QueuesPage`, `BackendsPage` |
| Provider connectors | `ProvidersPage`, `ConnectorsPage` |

### 5. Metering, reconcile, audit (XDMoD + Argo)

| Reference | QRP equivalent |
| --- | --- |
| Usage charts | `MeteringPage`, Home quota charts |
| Reconcile unresolved dispatch | `ReconciliationPage` |
| Auditor trail | `AuditPage` (governance events) + `GET /api/v1/rbac/audit` (identity/RBAC today) |

---

## Component-level borrow list (React)

| Pattern | Reference project | QRP target file |
| --- | --- | --- |
| Dense KPI strip + tables | ColdFront, XDMoD | `KpiStrip`, `DataTable`, `OverviewKpiScroll` |
| Wizard / stepped forms | ColdFront allocation wizards | `ProjectCreateWizard`, `WorkloadSubmitWizard` |
| Job status chips | OnDemand, qBraid lab | `StatusBadge`, jobs table columns |
| Calendar / timeline holds | Blazar horizon UI (conceptual) | `ReservationCalendar` |
| Queue depth widgets | OnDemand dashboard | `CentrePage`, Home dashboard |
| Append-only log table | XDMoD, Argo UI event streams | `AuditPage` |

---

## What we do **not** copy verbatim

- **ColdFront / OnDemand / XDMoD:** Django/PHP/Angular stacks — copy **information architecture**, not templates.
- **Blazar / OpenStack:** Full control-plane weight; copy **lease model** only.
- **qBraid:** Commercial multi-cloud product UX — copy **backend selector + job status**, keep QRP IBM Plex / ops chrome from `DESIGN.md`.
- **Quantify Scheduler:** Lab instrument timing — map to **evidence / telemetry** on job detail, not main nav.

---

## Cloned reference trees

See `vendor-references/README.md` for `git clone --depth 1` commands and disk notes. Shallow clones are for **UI/API archaeology** (grep templates, URL patterns, state names) — not production dependencies.

| Directory | Upstream | QRP focus |
| --- | --- | --- |
| `vendor-references/coldfront/` | coldfront/coldfront | Projects, allocations, approvals |
| `vendor-references/ondemand/` | OSC/ondemand | Job composer, dashboards (large repo) |
| `vendor-references/xdmod/` | ubccr/xdmod | Metering, roles, reports |
| `vendor-references/qbraid/` | qbraid/qbraid | Multi-provider dispatch |
| `vendor-references/ftqmp-scheduler/` | team-QMP/FTQMP-Scheduler | Schedule visualization |
| `vendor-references/blazar/` | openstack/blazar | Reservation / lease API |
| `vendor-references/argo-workflows/` | argoproj/argo-workflows | Reconcile workflow UI metaphors |

Optional (not cloned by default — huge or niche):

- [hpc-toolset-tutorial](https://github.com/ubccr/hpc-toolset-tutorial) — ColdFront + OnDemand + XDMoD integration walkthrough
- [Quantify Scheduler](https://github.com/QuTech-Delft/quantify-scheduler) — pulse-level evidence
- QCRAFT-style schedulers — search GitHub for active `QCRAFT` REST queue repos before adopting

---

## QRP module backlog informed by vendors

| Module API (UI already calls) | Vendor model | Priority |
| --- | --- | --- |
| `/projects`, `/workload-submissions`, `/approvals/*` | ColdFront | P0 |
| `/quotas/ledger`, `/quotas/evaluate` | ColdFront + XDMoD | P0 |
| `/reservations` | Blazar leases | P1 |
| `/jobs`, `/dispatch-attempts`, `/reconciliation` | OnDemand + qBraid | P1 |
| `/meter-rollups`, `/governance/audit-events` | XDMoD | P2 |
| `/inventory/assets`, `/providers` | ColdFront resources + custom catalogue | P2 |

Today only **identity/admin/RBAC audit** + **lab stubs** are mounted in QRP backend — see `docs/product/FULL_STACK_STATUS.md`.

---

## How to use clones in Cursor

1. Open `vendor-references/coldfront/` and search `allocation`, `project`, `approval` in templates or React if present.
2. Map field names to `frontend/src/lib/validation/schemas.ts` and LLD API catalogue.
3. Record deltas in this file or `docs/DECISIONS.md` — do not import vendor code into `frontend/` without licence review.

---

## Links (canonical)

- ColdFront: https://github.com/coldfront/coldfront  
- CCR ColdFront docs: https://github.com/ubccr/ccrdocs/blob/main/pages/portals/coldfront.md  
- Open OnDemand: https://github.com/OSC/ondemand  
- Open XDMoD: https://github.com/ubccr/xdmod  
- Blazar: https://github.com/openstack/blazar  
- qBraid: https://github.com/qbraid/qbraid  
- FTQMP-Scheduler: https://github.com/team-QMP/FTQMP-Scheduler  
- Argo Workflows: https://github.com/argoproj/argo-workflows  
- IonQ qBraid SDK docs: https://docs.ionq.com/sdks/qbraid  
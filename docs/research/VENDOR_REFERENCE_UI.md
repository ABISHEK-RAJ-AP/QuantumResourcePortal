# Vendor reference UI — QRP lifecycle vs open-source patterns

**Purpose:** No single OSS quantum repo implements the full QRE lifecycle (project → approve → quota → reserve → dispatch → reconcile → audit). QRP composes **HPC/cloud governance UIs** with **quantum orchestration** patterns. This doc maps each QRP surface to reference projects and clone paths under `vendor-references/`.

**Phase 1 research workspace (code-verified inventories, workflow mapping, roadmaps):** [`../reference-analysis/`](../reference-analysis/) — start with [`REFERENCE_REPOSITORY_INVENTORY.md`](../reference-analysis/REFERENCE_REPOSITORY_INVENTORY.md) and [`QRP_REFERENCE_RECONSTRUCTION_MASTER.md`](../product/QRP_REFERENCE_RECONSTRUCTION_MASTER.md) (canonical Cursor prompt).

**QRP stack (this repo):** React 19 + Vite + TanStack Query · FastAPI + PostgreSQL + Redis · national-lab style RBAC (not multi-tenant SaaS marketing chrome).

**QRP UI style (narrowing your question):** **Modern React/TypeScript ops console** (dense tables, KPI strips, breadcrumbs, contextual wizards) — not server-rendered Django admin skins. Use **both**: (a) **Docker stack** to run the integrated HPC tutorial end-to-end; (b) **shallow clones** under `vendor-references/` for grep/wireframe archaeology without forking PHP/Django into QRP.

---

## Summary mapping (workflow step → best OSS UI)

| Step | Best open-source UI reference | Also useful |
| --- | --- | --- |
| 1. Project & quota request | **ColdFront** | CompanyOS (project-scoped RBAC) |
| 2. Review, approval & quota check | **ColdFront** admin | **Kortix CompanyOS** change-request approvals |
| 3. Time-window capacity reservation | **LibreBooking** calendar | **OpenStack Blazar** (+ Horizon patterns) |
| 4. Multi-backend job dispatch | **Open OnDemand** | **CodeFlare** (K8s quota/queue), qBraid (quantum) |
| 5. Metering, reconciliation & audit | **Open XDMoD** | **UBCCR HPC toolset**, Argo UI, QRP `/rbac/audit` |

---

## A. Integrated HPC & AI cluster governance (run together)

Official **UBCCR HPC Toolset Tutorial** wires all three portals for local Docker study:

| Role | Project | Clone path | Inspect for |
| --- | --- | --- | --- |
| Projects, approvals, quotas | [ColdFront](https://github.com/coldfront/coldfront) | `vendor-references/coldfront/` | PI projects, allocation requests, renewals, xdmod plugin hooks |
| Job composer, queues, files | [Open OnDemand](https://github.com/OSC/ondemand) | `vendor-references/ondemand/` | Dashboard, job status, app launchers |
| Metering, QoS, auditor reports | [Open XDMoD](https://github.com/ubccr/xdmod) | `vendor-references/xdmod/` | Charts, reconciliation vs scheduler logs |
| **All-in-one Docker lab** | [hpc-toolset-tutorial](https://github.com/ubccr/hpc-toolset-tutorial) | `vendor-references/hpc-toolset-tutorial/` | Compose topology, how CF→OOD→XDMoD connect |

**Run locally (after clone):** follow `vendor-references/hpc-toolset-tutorial/README.md` — requires Docker; use for **integration behaviour**, not as QRP dependency.

**ColdFront ↔ XDMoD plugin:** `coldfront/plugins/xdmod/` in ColdFront clone — allocation vs usage reconciliation pattern.

---

## B. Cloud & AI platforms (approvals, quotas, routing)

| Project | Repo | Clone | QRP screen to inform |
| --- | --- | --- | --- |
| **Kortix CompanyOS** | [kortix-ai/CompanyOS](https://github.com/kortix-ai/CompanyOS) | `vendor-references/companyos/` | Person-in-the-loop approvals, project secrets, provider routing budgets, immutable audit log (SaaS-like; contrast with QRP ops restraint) |
| **CodeFlare** (MCAD / multi-cluster queue) | [project-codeflare/codeflare](https://github.com/project-codeflare/codeflare) | `vendor-references/codeflare/` | Priority queues, quota enforcement, multi-backend dispatch on Kubernetes |
| **Google quota monitoring** | [google/quota-monitoring-solution](https://github.com/google/quota-monitoring-solution) | `vendor-references/quota-monitoring-solution/` | Threshold dashboards, alert wiring (patterns for `QuotasPage` / Home KPIs) |
| **GovTech cstack quota** | [GovTechSG/cstack-quota-monitoring](https://github.com/GovTechSG/cstack-quota-monitoring) | `vendor-references/cstack-quota-monitoring/` | Project-level limits + utilization UI (government ops tone) |

These complement HPC trio: stronger on **cloud quota UX** and **AI job routing**, weaker on national-lab grant cycles (ColdFront still wins step 1–2).

---

## C. Time-window reservations (calendar holds)

| Project | Repo | Clone | QRP mapping |
| --- | --- | --- | --- |
| **LibreBooking** | [LibreBooking/librebooking](https://github.com/LibreBooking/librebooking) | `vendor-references/librebooking/` | Calendar holds, credits/quotas, approval workflows, waitlists — closest OSS **booking UI** to `ReservationCalendar` |
| **OpenStack Blazar** | [openstack/blazar](https://github.com/openstack/blazar) | `vendor-references/blazar/` | Lease lifecycle, conflict checks, host-level leases (pair with Horizon screenshots in OpenStack docs) |

QRP uses **Blazar semantics** in API design; **LibreBooking** is the better reference for **operator-friendly calendar UX**.

---

## Lifecycle → reference matrix (quantum + HPC combined)

| QRP step | QRP routes / components | Primary OSS reference | What to steal (UI + API shape) |
| --- | --- | --- | --- |
| **Submit** — project + workload package | `ProjectsPage`, `ProjectCreateWizard`, `WorkloadSubmitWizard`, `ProjectDetailPage` | [ColdFront](https://github.com/coldfront/coldfront) | PI projects, allocation requests, collaborator membership, request metadata forms |
| **Review / Authorise** — staged decisions | `ApprovalsPage`, `ApprovalDetailPage`, `WorkflowSteps` on detail | ColdFront admin, **CompanyOS** change requests | Multi-step review queue, approver comments, eligibility checks |
| **Quota** — ledger & evaluate | `QuotasPage`, approval quota panel | ColdFront, XDMoD, **quota-monitoring-solution**, **cstack-quota-monitoring** | Allocation limits, usage vs cap, alerts |
| **Schedule hold** — capacity window | `ReservationsPage`, `SchedulingPage`, `ReservationCalendar` | **LibreBooking**, Blazar, FTQMP-Scheduler | Calendar UX, lease timeline, conflicts, QPU viz |
| **Dispatch** — provider attempts | `DispatchPage`, `JobsPage`, `ReconciliationPage` | OnDemand, **CodeFlare**, qBraid | Job composer, queue status, multi-backend picker |
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

### 3. Capacity reservation calendar (LibreBooking + Blazar + FTQMP)

| Reference | QRP equivalent |
| --- | --- |
| Calendar + credits + approval | LibreBooking → `ReservationCalendar`, `ReservationsPage` |
| Lease API / conflicts | Blazar → transition POST, `reservationHoldSchema` |
| Spatial schedule viz | FTQMP → future ops chart on `CentrePage` |

### 4. Job dispatch & multi-backend (OnDemand + CodeFlare + qBraid)

| Reference | QRP equivalent |
| --- | --- |
| Job composer / script panel | OnDemand → project submit + job detail |
| Multi-cluster quota queue | CodeFlare → `JobsPage`, `QueuesPage` |
| Quantum provider picker | qBraid → `ProvidersPage`, `ConnectorsPage` |

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
| Calendar / timeline holds | LibreBooking, Blazar | `ReservationCalendar` |
| Quota alert dashboards | Google quota solution, cstack | `QuotasPage`, Home KPIs |
| SaaS-style approval inbox | CompanyOS | contrast only — QRP uses approvals queue |
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
| `vendor-references/hpc-toolset-tutorial/` | ubccr/hpc-toolset-tutorial | Docker-integrated ColdFront + OOD + XDMoD |
| `vendor-references/librebooking/` | LibreBooking/librebooking | Calendar reservation UI |
| `vendor-references/companyos/` | kortix-ai/CompanyOS | Approvals, audit, provider budgets |
| `vendor-references/codeflare/` | project-codeflare/codeflare | K8s job queue + quotas |
| `vendor-references/quota-monitoring-solution/` | google/quota-monitoring-solution | Quota dashboards / alerts |
| `vendor-references/cstack-quota-monitoring/` | GovTechSG/cstack-quota-monitoring | Gov quota UI patterns |

Optional (not cloned by default — huge or niche):

- [Awesome HPC](https://github.com/dstdev/awesome-hpc) — index of OnDemand and peers
- [Quantify Scheduler](https://github.com/QuTech-Delft/quantify-scheduler) — pulse-level evidence
- QCRAFT-style schedulers — verify repo before adopt

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
- HPC toolset tutorial: https://github.com/ubccr/hpc-toolset-tutorial  
- LibreBooking: https://github.com/LibreBooking/librebooking  
- CompanyOS: https://github.com/kortix-ai/CompanyOS  
- CodeFlare: https://github.com/project-codeflare/codeflare  
- Google quota monitoring: https://github.com/google/quota-monitoring-solution  
- cstack quota monitoring: https://github.com/GovTechSG/cstack-quota-monitoring  
- Awesome HPC: https://github.com/dstdev/awesome-hpc  
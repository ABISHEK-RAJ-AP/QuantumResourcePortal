# Reference workflow mapping

**Governance lifecycle (QRP):** Submit → Review → Authorise → Schedule hold → Dispatch → Evidence  
(`frontend/src/lib/workflow/governance.ts`, `WORKSPACE_UI_CATALOG.md`)

Global step rail **only** on record detail and wizards — not list/hub pages.

## Step → reference → QRP surfaces

| Step | QRP routes / components | Primary references (verified code) | Patterns to extract |
| --- | --- | --- | --- |
| **Submit** | `ProjectCreateWizard`, `WorkloadSubmitWizard`, `ProjectsPage`, `ProjectDetailPage` | **ColdFront** — `allocation/urls.py` (`allocation-create`, `allocation-request-list`); **CompanyOS** — approval/project monorepo (human-in-the-loop) | Multi-step request forms; project-scoped membership; request metadata |
| **Review** | `ApprovalsPage`, `ApprovalDetailPage`, quota panels | **ColdFront** — `AllocationRequestListView`, change requests; DRF `AllocationChangeRequestViewSet` | Queue filters; approver comments; eligibility display |
| **Authorise** | Approval decide actions, policy checks | ColdFront admin views; CompanyOS change-request UX | Staged decisions; audit-worthy outcomes |
| **Schedule hold** | `ReservationsPage`, `SchedulingPage`, `ReservationCalendar` | **Blazar** — lease lifecycle API; **LibreBooking** — calendar booking (`Web/` PHP UI) | Time windows; conflicts; waitlist |
| **Dispatch** | `DispatchPage`, `JobsPage`, `ReconciliationPage` | **OnDemand** — `routes.rb` jobs, workflows, launchers; **MCAD** — K8s queue/dispatch; **qBraid** — provider job API | Job composer; queue status; multi-backend picker |
| **Evidence** | `AuditPage`, evidence drill-down, `/rbac/audit` | **XDMoD** — reporting/ETL; **Argo Workflows** — step graph + event history | Immutable events; export; execution provenance |

## QRP module table (from reconstruction spec)

| QRP module | Primary references | Expected outcome |
| --- | --- | --- |
| Home dashboard | XDMoD, Horizon (docs until clone) | Operational intelligence dashboard |
| Operations Centre | OnDemand, XDMoD | Live infrastructure monitoring |
| Projects | ColdFront, CompanyOS | Complete project management |
| Approvals | ColdFront, Horizon patterns | Professional review workspace |
| Inventory | Horizon patterns, OpenStack APIs | Resource catalogue |
| Providers | Horizon, qBraid | Provider administration |
| Backends | qBraid, OpenStack | Quantum backend configuration |
| Virtual Pools | Blazar | Resource pooling |
| Queues | OnDemand, MCAD | Queue and priority management |
| Reservations | Blazar, LibreBooking | Capacity reservation calendar |
| Scheduling | Blazar, FTQMP-Scheduler | Scheduling and placement |
| Jobs | OnDemand, qBraid | Execution monitoring |
| Dispatch | MCAD, qBraid | Multi-backend dispatch |
| Reconciliation | XDMoD, MCAD | Actual vs authorised consumption |
| Incidents | Horizon patterns, Argo | Operational incident management |
| Policies | ColdFront | Governance policies |
| Quotas | ColdFront, MCAD, quota-monitoring-solution | Allocation and enforcement |
| Metering | XDMoD | Usage and accounting |
| Audit | XDMoD, Argo | Traceable operational records |
| Evidence | Argo, XDMoD | Execution evidence and provenance |
| Access control | Horizon patterns, CompanyOS | Roles and scoped access |
| Settings | OnDemand sys prefs, ColdFront admin | Workspace configuration |

## Backend contract alignment (target)

| Workflow step | Target FastAPI slice (future) | Reference API shape |
| --- | --- | --- |
| Submit | `svc` project + workload submission | ColdFront DRF read models; qBraid job create |
| Review | Approval service + policy engine | ColdFront allocation change requests |
| Authorise | Approval decision + audit append | Hash-chained audit (existing) + domain events |
| Schedule hold | Reservation service | Blazar lease states; LibreBooking slots |
| Dispatch | Dispatch orchestrator + adapters | MCAD AppWrapper; qBraid provider routing |
| Evidence | Evidence snapshots + audit read APIs | Argo workflow status; XDMoD job metrics export |

## Anti-patterns

- Copying ColdFront Django templates into React.
- Treating lab `demo: true` JSON as production metrics.
- Putting Submit→Evidence rail on every list page.
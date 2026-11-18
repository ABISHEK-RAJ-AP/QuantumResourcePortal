# Reference component catalog → QRP

Maps **verified reference patterns** to QRP components (existing or planned). Implementation in Phase 3–5.

| Reference pattern | Source (verified) | QRP component / location | Implementation status | Notes |
| --- | --- | --- | --- | --- |
| App shell + grouped nav | ColdFront `authorized_navbar.html`; OnDemand dashboard layout | `frontend/src/components/layout/chrome.tsx` `NAV` | **exists** | Work/Resources/Compute/Govern/Admin groups |
| Breadcrumbs | OnDemand project context; QRP already | `frontend/src/components/layout/Breadcrumbs.tsx`, `Page.tsx` | **exists** | List pages: module crumbs only |
| Page header + actions | ColdFront list views | `frontend/src/components/layout/Page.tsx` | **exists** | Primary CTA right |
| KPI strip | XDMoD summaries; lab KPIs today | `frontend/src/components/layout/Page.tsx` `MetricTile`, `KpiStrip` | **extend** | Bind real APIs; `—` on error (`OverviewPage`, `ProjectsPage`) |
| Data table + pagination | OnDemand DataTables; ColdFront paginator | `frontend/src/components/data/Table.tsx`, workspace tables | **exists** | Server pagination later |
| Filter bar | ColdFront search views | `frontend/src/components/data/FilterBar.tsx` | **exists** | TanStack Query keys |
| Status badges | Blazar lease states; job states | `frontend/src/components/ui/StatusBadge.tsx` | **exists** | Map LLD enums |
| Multi-step wizard | ColdFront allocation create; OnDemand workflows | `ProjectCreateWizard.tsx`, `WorkloadSubmitWizard.tsx` | **extend** | Create wired to `POST /projects`; submit still stub |
| Contextual workflow rail | QRP governance spec | `WorkflowSteps.tsx`, `lib/workflow/governance.ts` | **exists** | Not on list pages |
| Approval detail workspace | ColdFront change detail | `frontend/src/pages/workspace/screens.tsx` `ApprovalDetailPage` | **extend** | Needs real `/approvals/*` |
| Calendar / holds | LibreBooking `Web/` | `frontend/src/components/data/ReservationCalendar.tsx` | **new** | Phase 5.8 |
| Job monitor + actions | OnDemand `projects#job_details` | `JobsPage`, `JobDetailPage` in `screens.tsx` / `continue.tsx` | **extend** | `/jobs` not implemented |
| Workflow DAG | Argo `ui/` React | Future `WorkflowGraph` | **new** | Optional |
| Chart panel | XDMoD Highcharts (PHP UI) | `ChartPanel.tsx`, `chartTheme` consumers | **exists** | CSS `--chart-*` only |
| Activity feed | ColdFront notifications; centre ops | Home/Centre activity lists in `screens.tsx` | **extend** | Lab `/governance/activity` |
| Audit/event table | QRP `/rbac/audit`; XDMoD reports | `AuditPage`, `api/rbac.ts` admin export | **extend** | RBAC audit real; governance audit TBD |
| Provider card | qBraid provider listing | `ProviderDetailPage` in `continue.tsx` | **extend** | `/providers` stub |
| Empty/loading/error | CompanyOS modern patterns (contrast) | `QueryBody.tsx`, `EmptyState`, `DataState` | **exists** | Honest API errors |
| Quick action dock | QRP unique | `QrpQuickActionDock.tsx` | **exists** | Don't duplicate header nav |
| CAPTCHA field | N/A in references | `CaptchaField.tsx` | **exists** | Preserve auth |
| Permission gate | DRF permissions; Rails constraints | `ProtectedRoute.tsx`, `require_permission` | **exists** | Double enforcement |
| Projects list + create | ColdFront project list | `ProjectsPage`, `ProjectCreateWizard` | **extend** | **Real** `backend/qre/services/svc03_projects/api.py` |

## Gap list (components to spec in Phase 3)

- `QuotaEvaluatePanel` (ColdFront + MCAD semantics)  
- `DispatchAttemptTimeline` (Argo + MCAD)  
- `ReconciliationVarianceTable` (XDMoD)  
- `BackendCapabilityPanel` (qBraid metadata)  
- `EvidenceArtifactViewer` (Argo outputs)  
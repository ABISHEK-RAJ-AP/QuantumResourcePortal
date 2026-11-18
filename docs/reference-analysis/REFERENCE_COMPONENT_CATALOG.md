# Reference component catalog → QRP

Maps **verified reference patterns** to QRP components (existing or planned). Implementation in Phase 3–5.

| Reference pattern | Source (verified) | QRP component / location | Notes |
| --- | --- | --- | --- |
| App shell + grouped nav | ColdFront `authorized_navbar.html`; OnDemand dashboard layout | `AppShell`, `chrome.tsx` `NAV` | Keep QRP Work/Resources/Compute/Govern/Admin groups |
| Breadcrumbs | OnDemand project context; QRP already | `Breadcrumbs`, `Page` `crumbs` | List pages only |
| Page header + actions | ColdFront list views | `Page` `title`, `description`, `actions` | Primary CTA right |
| KPI strip | XDMoD summaries (see xdmod.md); lab KPIs today | `OverviewPage` grid, `MetricTile` patterns | Must bind real APIs |
| Data table + pagination | OnDemand DataTables; ColdFront Django paginator | `DataTable` (workspace tables) | Server-side sort/filter |
| Filter bar | ColdFront search views | Table toolbar components | TanStack Query `searchParams` |
| Status badges | Blazar lease states; job states | `StatusBadge` | Map LLD enums |
| Multi-step wizard | ColdFront allocation create; OnDemand workflows | `ProjectCreateWizard`, `WorkloadSubmitWizard` | Dialog steps |
| Contextual workflow rail | QRP governance spec | `WorkflowSteps`, `lib/workflow/governance.ts` | **Not** on list pages |
| Approval detail workspace | ColdFront change detail | `ApprovalDetailPage` | Tabs + trail from API |
| Calendar / holds | LibreBooking `Web/` | `ReservationCalendar` | Phase 5.8 |
| Job monitor + actions | OnDemand `projects#job_details` | `JobsPage`, `JobDetailPage` | Polling interval policy |
| Workflow DAG | Argo `ui/` React | Future `WorkflowGraph` (optional) | Evidence/dispatch timeline first |
| Chart panel | XDMoD Highcharts (PHP UI) | `chartTheme.js` consumers | No copied chart assets |
| Activity feed | ColdFront notifications; centre ops | Home/Centre activity lists | Real events only |
| Audit/event table | QRP `/rbac/audit`; XDMoD reports | `AuditPage`, admin export | Split RBAC vs governance |
| Provider card | qBraid provider listing | `ProviderDetailPage` | Adapter health |
| Empty/loading/error | CompanyOS modern patterns (contrast) | Skeletons in `components/ui` | Honest API errors |
| Quick action dock | QRP unique | `QrpQuickActionDock` | Don't duplicate header nav |
| CAPTCHA field | N/A in references | `CaptchaField` | Preserve auth |
| Permission gate | DRF permissions; Rails constraints | `ProtectedRoute`, backend `require_permission` | Double enforcement |

## Gap list (components to spec in Phase 3)

- `QuotaEvaluatePanel` (ColdFront + MCAD semantics)  
- `DispatchAttemptTimeline` (Argo + MCAD)  
- `ReconciliationVarianceTable` (XDMoD)  
- `BackendCapabilityPanel` (qBraid metadata)  
- `EvidenceArtifactViewer` (Argo outputs)
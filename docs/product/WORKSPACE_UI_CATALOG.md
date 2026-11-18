# QRP workspace UI catalog

For API reachability, backend vs lab stubs, DB, auth, cache, and per-page data contracts see [`FULL_STACK_STATUS.md`](./FULL_STACK_STATUS.md).  
OSS UI patterns (ColdFront, OnDemand, Blazar, XDMoD, qBraid, …): [`../research/VENDOR_REFERENCE_UI.md`](../research/VENDOR_REFERENCE_UI.md) · clones: `vendor-references/`.

Operator console at `/qrp/*`. Breadcrumbs and shell header come from each page’s `Page` `crumbs` prop via `useSetPageChrome`. **Global six-step governance rail removed from list/hub pages**; lifecycle steps appear only in context (approval detail, asset/incident records, **New project** wizard).

## Shared chrome (authenticated shell)

| Region | Source | Contents |
| --- | --- | --- |
| **Left nav** | `frontend/src/components/layout/chrome.tsx` `NAV` | Groups: Work, Resources, Compute, Govern, Admin. Collapse, badges (approvals, reconcile, alerts, incidents). |
| **Header** | Sticky bar | Breadcrumbs (`Breadcrumbs`), page title, description, `DataFreshness`, notification bell, layout prefs, manual refresh, theme toggle. |
| **Body** | `Page` children | Cards, tables, charts, record workspaces. Optional page-level `actions` row (primary buttons). |
| **Dock** | `QrpQuickActionDock` | Context quick actions (not duplicated in header nav). |
| **Footer** | Public routes only | Landing/login use site footer; app shell has no marketing footer. |

## Workflow UI rules

| Pattern | Where |
| --- | --- |
| **Breadcrumbs only** | Home, Operations, Approvals queue, Projects list, Resources hubs, Govern hubs, Admin list pages. |
| **Step rail (Submit → … → Evidence)** | Approval **detail** (`/qrp/approvals/:id`), asset lifecycle detail, incident detail, dispatch/job detail where defined. |
| **Cert Studio–style wizard** | **New project** (`ProjectCreateWizard`); **submit workload** on project hub (`WorkloadSubmitWizard`) — steps inside dialog, Back/Next, confirm. |

Full lifecycle labels (reference): Submit, Review, Authorise, Schedule hold, Dispatch, Evidence — see `lib/workflow/governance.ts`.

---

## Work

### Home (`/qrp` — `OverviewPage`)

- **Crumbs:** Home.
- **Body:** Role-aware KPI strip, dashboard grid, lab demo banner when applicable.
- **No** global workflow rail.

### Operations (`/qrp/centre` — `CentrePage`)

- **Crumbs:** Operations.
- **Features:** Operations centre KPIs, alerts/incidents summary, links into support and jobs.
- **Queries:** `/operations/centre`, related ops APIs.

### Approvals (`/qrp/approvals` — `ApprovalsPage`)

- **Crumbs:** Governance → Review queue.
- **Features:** Filterable queue table, state chart, open-next / seed review actions.
- **Detail** (`ApprovalDetailPage`): full breadcrumb trail per tab; **contextual step rail** from server trail; decide, history, related reservations/dispatch.

### Projects (`/qrp/projects` — `ProjectsPage`)

- **Crumbs:** Governance → Projects.
- **Actions:** **New project** → `ProjectCreateWizard` (3-step preview + confirm).
- **Features:** KPI strip, type chart, table/cards, filters.
- **Detail** (`ProjectDetailPage` in `continue.tsx`): project hub; **Create resource request** opens `WorkloadSubmitWizard`; Requests tab has table + wizard CTA.

---

## Resources

### Resources / Inventory (`/qrp/inventory` — `InventoryPage`)

- **Crumbs:** Resources.
- **Features:** Asset catalogue, filters, register/import links.
- **Detail** (`AssetDetailPage`): **asset lifecycle** step rail (`LIFECYCLE`), tabs overview/lifecycle.

### Facilities & Providers (`/qrp/providers` — `ProvidersPage`)

- **Crumbs:** Resources → Providers.
- **Detail:** `ProviderDetailPage` — provider record, pools/backends embeds.

Related embedded surfaces: `PoolsPage`, `BackendsPage`, `QueuesPage`, `ConnectorsPage` (tabs under providers/inventory flows).

---

## Compute

### Jobs & Queues (`/qrp/jobs` — `JobsPage`)

- **Crumbs:** Compute → Jobs.
- **Detail:** `JobDetailPage` — job status, provider linkage.

### Dispatch reconcile (`/qrp/reconciliation` — `ReconciliationPage`)

- **Crumbs:** Compute → Reconcile.
- **Features:** Unresolved vs authorized dispatch attempts, reconcile actions.

### Incidents (`/qrp/support` — `SupportPage` / `IncidentsPage`)

- **Crumbs:** Compute → Incidents.
- **Detail:** `IncidentDetailPage` — **incident flow** step rail.

### Reservations (`/qrp/reservations` — `ReservationsPage`)

- **Crumbs:** Compute → Reservations.
- **Features:** Calendar/table holds, link from approved workloads.
- **Scheduling** (`/qrp/scheduling` — `SchedulingPage`): request holds.

### Dispatch (`/qrp/dispatch` — `DispatchPage`)

- Authorize/monitor dispatch attempts (separate route in `continue.tsx`).

---

## Govern

### Policies (`/qrp/policies` — `PoliciesPage`)

- Policy catalogue, versions, stage permissions.

### Quotas (`/qrp/quotas` — `QuotasPage`)

- Quota definitions and consumption hints.

### Metering (`/qrp/metering` — `MeteringPage`)

- Usage metering views and export hooks.

### Audit & Evidence (`/qrp/audit` — `AuditPage`)

- Append-only audit stream; **Evidence** page (`EvidencePage`) for artifact-oriented drill-down.

### Approval history (`/qrp/approvals/history` — `ApprovalHistoryPage`)

- Decision history table; breadcrumbs only.

---

## Admin

### Access (`/qrp/admin/users` — `UsersAdminPage`)

- User directory; links to roles, permissions, per-user editor routes.

### Settings (`/qrp/settings` — `SettingsPage`)

- Workspace preferences, integrations, onboarding links (`OnboardingPage`, entitlements, notifications, SLA subpages).

### Platform status (`/system/status` — `StatusPage`)

- API readiness, dependency checks (Postgres, Redis cache), version/build. May render framed inside shell.

---

## Public / auth (no app nav)

| Route | Page | Notes |
| --- | --- | --- |
| `/` | `LandingPage` | Hero, features, **GridPulse** (reduced cost: lower ambient/maxLit). |
| `/login` | `LoginPage` | CAPTCHA when required. |
| `/register`, `/forgot`, `/reset`, `/mfa` | respective pages | Identity flows. |

---

## Performance notes (2026-03)

- React Query default `staleTime` 60s; shell nav badge queries 90s interval.
- Removed automatic `qrp:data-refresh` on every governance summary fetch (was re-triggering `GovernNotificationSync` in a loop).
- Manual header **Refresh** still invalidates queries and dispatches `qrp:data-refresh`.

---

## File map

| Area | Primary files |
| --- | --- |
| Nav + shell | `components/layout/chrome.tsx`, `page-context.tsx`, `Breadcrumbs.tsx` |
| Page layout | `components/layout/Page.tsx` |
| Workflow | `components/workflow/*`, `lib/workflow/governance.ts` |
| Workspace routes | `pages/workspace/screens.tsx`, `pages/workspace/continue.tsx` |
| New project wizard | `components/workflow/ProjectCreateWizard.tsx` |
| Submit workload wizard | `components/workflow/WorkloadSubmitWizard.tsx` |
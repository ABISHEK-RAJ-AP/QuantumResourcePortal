# QRP design system — enterprise ops console

**Status:** Phase 3 (contracts + tokens; no wholesale reskin)  
**Authority:** Existing CSS variables in `frontend/src/styles/index.css` and layout components win over reference palettes. See also `docs/00_REQUIREMENTS_AND_DESIGN.md` §5.

---

## Principles

| Rule | Rationale |
| --- | --- |
| Governance-first density | Operators scan tables and KPIs; avoid marketing hero blocks on `/qrp/*`. |
| Honest data states | KPI tiles show `—` when the query errors; no placeholder counts. |
| Contextual workflow only | `WorkflowSteps` on detail pages and wizards — **not** on list routes. |
| Cookie + CSRF unchanged | No client-stored session; problem+json errors surface in `QueryBody`. |
| Reference pattern-only | AGPL/GPL repos inform structure; no vendor assets in `frontend/src`. |

---

## Layout grid

| Surface | Width / grid | Token / class notes |
| --- | --- | --- |
| App shell | Left nav fixed; main scroll | `--sidebar-*`, `chrome.tsx` |
| Page content | `max-w-[1400px]` centred in main | `Page` wrapper |
| KPI strip | `KpiStrip` — 2–5 columns responsive (`xl:grid-cols-5` on Projects) | `MetricTile` |
| Primary body | Single column or 2-col split in `RecordWorkspace` tabs | `Card` on `--card` |
| Tables | Full width inside `Card`; horizontal scroll on narrow viewports | `Table` / `DataTable` |
| Charts | `ChartPanel` height from workspace prefs | `--chart-1` … `--chart-5` series order |

**Density:** `WorkspaceLayoutControls` toggles compact vs comfortable; table rows use `text-sm` and `tabular-nums` for metrics.

---

## Page anatomy (standard)

Every workspace route should set chrome via `Page`:

1. **Breadcrumbs** — `crumbs={[{ label, to? }, …]}`; list pages end at module title (no fake trail).
2. **Header** — `title`, `description` (one line operator copy).
3. **Actions** — primary CTA right (`btn-primary`); secondary `btn-secondary` / `Link`.
4. **Optional KPI strip** — only when at least one query is wired; omit strip if all KPI sources 404.
5. **Body** — `Card`(s), `QueryBody`, or `RecordWorkspace` tabs.
6. **`updatedAt`** — pass query `dataUpdatedAt` when data-driven.

**Anti-patterns:** global governance step rail on list pages; duplicate nav in body and shell; badges without API backing.

---

## Tables

| Aspect | Contract |
| --- | --- |
| List fetch | `qre()` + `asList()` — accepts raw array or `{ items: [] }`. |
| Empty | `emptyTitle` / `emptyBody` or `EmptyState` with honest next step (e.g. create project). |
| Loading | `QueryBody` skeleton or table placeholder. |
| Status | `StatusBadge` with `tone` mapped from domain enum (`stateTone` / `stateLabel`). |
| IDs | `CopyableId` for ULIDs; never truncate in API. |
| Filters | `FilterBar` + client filter until server pagination ships. |

---

## Charts

- Recharts inside `ChartPanel`; colours from `--chart-*` CSS variables (light/dark preserved).
- No chart without non-empty series — hide panel or show `empty` prop.
- Axis labels ≤ 11px; Y-axis `allowDecimals={false}` for counts.
- KPI charts on list pages are **optional** (Projects type bar) — hide when `typeChart.length === 0`.

---

## Empty / error / loading

| State | Component | Copy |
| --- | --- | --- |
| Loading | `QueryBody` pending | No fake rows. |
| Error | `QueryBody` / `DataState` | `formatApiError`; 502 uses `apiReachability`. |
| Empty | `EmptyState` | Actionable (button or link). |
| Lab | `Notice` banner when `demo: true` in payload | Remove when production API replaces stub. |

---

## Light / dark tokens (reference)

Do **not** rename tokens in Phase 3. Map new UI to existing semantics:

| Role | Light (`:root`) | Dark (`.dark`) |
| --- | --- | --- |
| Canvas | `--background`, `--surface` | `#0b1220`, `#0f172a` |
| Text | `--foreground`, `--muted-foreground` | `#e8eef9`, `#93a0b8` |
| Primary actions | `--primary`, `--primary-foreground` | `#7b8cff` |
| Cards / chrome | `--card`, `--border` | `#121a2b`, dark border |
| Status success / warning / critical | `--success*`, `--warning*`, `--critical*` | Same semantic family |
| Charts | `--chart-1` … `--chart-5` | Dark overrides in `index.css` |
| Sidebar | `--sidebar-*` | Matched dark sidebar block |

Brand accents (`--brand-cyan`, `--brand-violet`) are for focus rings and highlights — not full-page backgrounds on ops routes.

---

## Component index (QRP-owned)

| Concern | Location |
| --- | --- |
| Shell | `components/layout/chrome.tsx`, `page-context.tsx`, `Breadcrumbs.tsx` |
| Page frame | `components/layout/Page.tsx` |
| Data | `components/data/QueryBody.tsx`, `DataTable`/`Table`, `FilterBar`, `KpiStrip` |
| Feedback | `components/ui/EmptyState`, `Notice`, `StatusBadge` |
| Wizards | `components/workflow/ProjectCreateWizard.tsx`, `WorkloadSubmitWizard.tsx` |

Module routes and UI contracts: `docs/product/WORKSPACE_UI_CATALOG.md`. Backend truth: `docs/product/FULL_STACK_STATUS.md`. Reference mapping (local only): `docs/reference-analysis/REFERENCE_COMPONENT_CATALOG.md` if present on disk.
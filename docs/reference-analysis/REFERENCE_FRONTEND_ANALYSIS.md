# Reference frontend analysis

Phase 1 begins with **ColdFront** and **Open OnDemand** (code-verified). Other repos: see `repositories/*.md`.

---

## ColdFront (`vendor-references/coldfront`)

### Stack (verified)

| Layer | Evidence |
| --- | --- |
| Server UI | **Django 4.2** templates + **django-htmx** + **crispy-bootstrap5** (`pyproject.toml`) |
| Static pipeline | **Vite 7** + TypeScript in `coldfront/static/package.json` (AGPL-3.0-or-later in package metadata) |
| Not SPA | Class-based views; partial HTMX swaps |

### Key directories

| Path | Role |
| --- | --- |
| `coldfront/core/project/` | PI projects, search, membership |
| `coldfront/core/allocation/` | Requests, renewals, change lists |
| `coldfront/core/resource/` | Resource catalogue |
| `coldfront/templates/common/` | Navbar variants (admin, director, login) |
| `coldfront/plugins/api/` | DRF read APIs (not primary HTML UI) |

### Routing patterns (Django `urls.py`)

Examples from `coldfront/core/allocation/urls.py`:

- `allocation-list`, `allocation-create` (project-scoped)
- `allocation-request-list`, `allocation-change-list`
- Detail routes: `allocation-detail`, `allocation-renew`, user add/remove

Project flows mirror in `coldfront/core/project/urls.py` (list, detail, add users).

### UI composition patterns for QRP

| Pattern | ColdFront implementation | QRP equivalent |
| --- | --- | --- |
| Staff vs PI nav | `templates/common/*navbar*.html` | `chrome.tsx` NAV groups + `me/navigation` |
| Paginated tables | Django `Paginator` in views | `DataTable` + server pagination |
| Request wizard | Multi-page CBVs + forms | `ProjectCreateWizard`, `WorkloadSubmitWizard` |
| Status messaging | `messages` framework | `toast` + inline alerts |
| Admin density | Bootstrap tables in templates | Ops console density (not Bootstrap skin copy) |

### Templates vs React

ColdFront uses **server-rendered** pages with HTMX for partial updates. QRP should translate **information architecture** (project → allocation request → approval queue) into React **record workspaces**, not replicate HTMX endpoints.

### Limitations for direct reuse

- AGPL — no template copy.
- Bootstrap 5 skin conflicts with QRP DESIGN.md unless explicitly reconciled in Phase 3.

---

## Open OnDemand (`vendor-references/ondemand`)

### Stack (verified)

| Layer | Evidence |
| --- | --- |
| Dashboard app | **Ruby on Rails** — `apps/dashboard/config/routes.rb` |
| Front-end assets | `apps/dashboard/package.json`: Bootstrap 5, jQuery, DataTables, **Turbo Rails**, esbuild, Sass |
| Shell app | `apps/shell/` — Node Express (`app.js` routes `/`, `/ssh`) |
| Job composer | `apps/myjobs/config/routes.rb` |

### Key routes (`apps/dashboard/config/routes.rb`)

| Route area | Purpose |
| --- | --- |
| `resources :projects` | Project-scoped job/workspace hub |
| `.../jobs/:cluster/:jobid` | Job detail (turbo_stream), stop/delete |
| `resources :workflows` | Job composer submit/save/load/clone |
| `resources :launchers` | Interactive app launchers |
| `files/:fs(/*filepath)` | File browser (gated by `Configuration.can_access_files?`) |

### UI patterns for QRP

| Pattern | OnDemand | QRP mapping |
| --- | --- | --- |
| Researcher landing | Dashboard home | `/qrp` + `/qrp/centre` |
| Job monitor table | DataTables + cluster filter | `JobsPage`, `JobDetailPage` |
| Job actions | stop/delete POST routes | Dispatch cancel/retry (with CSRF) |
| App launchers | Launcher resources | Provider connector “open console” (future) |
| File adjacency | Files routes | Out of scope unless LLD adds artifact store |

### Frontend takeaway

OnDemand is **not React** — it is Rails + progressive enhancement. QRP should borrow **job table density**, **cluster/backend selector**, and **workflow composer steps** (submit → monitor), implemented with TanStack Query polling and existing `Page` chrome.

### Limitations

- MIT license — patterns OK; no asset copy.
- Requires live HPC — screenshots deferred to Phase 2 (`screenshots/`).

---

## Next repos (Phase 1 stubs / Phase 2 depth)

XDMoD (PHP/JS charts), LibreBooking (calendar), Argo UI (React workflow graph), CompanyOS (modern React reference for approvals).
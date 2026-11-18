# QRP reference reconstruction — implementation log

| Date | Phase | Scope | Outcome |
| --- | --- | --- | --- |
| 2026-11-18 | **Phase 1** | Reference research workspace | Created `docs/reference-analysis/` with inventory, current-state audit, workflow mapping, target architecture, roadmap, master prompt, per-repo stubs (top priority), begun frontend/backend/component analyses; shallow-cloned `vendor-references/mcad`; updated `clone-all.sh`, `VENDOR_REFERENCE_UI.md`, root `README.md`. **No production src changes.** |
| 2026-11-18 | **Phase 3** | Design system contracts | Added `docs/product/QRP_DESIGN_SYSTEM.md` (layout, page anatomy, tables/charts, states, token map). Updated `REFERENCE_COMPONENT_CATALOG.md` with **Implementation status** column. Added `.cursor/rules/qrp-reconstruction.mdc`. |
| 2026-11-18 | **Phase 6 P2** | Projects API slice | `svc03_projects` — `GET/POST /projects`, `GET /projects/{id}`; scope via Authorizer; `test_projects_api.py`. |
| 2026-11-18 | **Phase 6 P2** | Workloads + approvals | Alembic `0006`; `svc06_approvals` — submissions, submit-for-review, approvals CRUD, `GET /governance/summary` (DB-backed, empty counts when no rows). Lab removed duplicate `/governance/summary` + `/approvals`. `test_governance_workspace.py`. |

## Next actions (after user review)

1. **Reservations** and **inventory** module routers (next slice).
2. `GET /projects/{id}/members`, `GET /governance/activity` for project hub tabs.
3. Incremental Home/ops lab stubs → production (`/operations/centre`, quotas ledger).

## Blockers (honest)

| Blocker | Impact |
| --- | --- |
| Most workspace APIs still **404** (inventory, reservations, …) | Home/ops tabs partial until remaining Phase 6 routers land |
| OpenStack Horizon **not cloned** | Inventory/provider patterns rely on Blazar API + docs until Horizon clone optional |
| `hpc-toolset-tutorial` **archived** | Integrated Docker lab may be stale |
| MCAD / Blazar / Argo need Kubernetes or OpenStack | Local UI run infeasible on laptop without cluster |

## Pattern adoption log (empty until Phase 5+)

| Module | Pattern source | Files changed | Verified |
| --- | --- | --- | --- |
| Projects | ColdFront project registry (pattern) | `svc03_projects/*`, `gateway/app.py`, `test_projects_api.py` | pytest integration |
| Approvals / workloads | ColdFront + LLD approval queue | `svc06_approvals/*`, migration `0006`, `test_governance_workspace.py` | pytest integration |
# QRP implementation roadmap (Phases 1–8)

Aligned with master reconstruction prompt. **Module order for Phase 5:** Home → … → Settings (see §Phase 5 list).

## Phase 1 — Reference research ✅ (this commit)

| Gate | Criteria |
| --- | --- |
| G1.1 | `docs/reference-analysis/` with inventory, audit, mapping, architecture, roadmap |
| G1.2 | Top-priority repo stubs with **code evidence** |
| G1.3 | `mcad` clone + `clone-all.sh` |
| G1.4 | No production src/CSS changes |

**Exit:** User reviews architecture + roadmap before Phase 3 cosmetic/component work.

## Phase 2 — QRP audit (deep)

| Work | Verify |
| --- | --- |
| Per-route component + query map | Spreadsheet or `page-comparison.md` |
| OpenAPI vs `qre()` client paths | Grep mismatch list |
| Playwright smoke per nav item | Document 404 vs lab vs real |

**Gate G2:** Every `/qrp/*` route has classification 1–6 from audit doc.

## Phase 3 — Design system

| Work | Verify |
| --- | --- |
| Layout standards (density, page width) | DESIGN tokens unchanged unless user approves |
| Shared component contracts | `REFERENCE_COMPONENT_CATALOG.md` updated |
| Storybook or doc examples (optional) | A11y keyboard pass on shell |

**Gate G3:** Shell + `Page` + `DataTable` API stable before page rebuilds.

## Phase 4 — Application shell

| Work | Verify |
| --- | --- |
| Nav badges wired to real counts when APIs exist | No fake badge numbers |
| Notifications, refresh, breadcrumbs | E2E smoke |
| Responsive + dark theme | Visual QA checklist |

**Gate G4:** Quality gates §12 shell items pass.

## Phase 5 — Frontend reconstruction (module order)

1. Home  
2. Operations Centre  
3. Approvals  
4. Projects  
5. Inventory  
6. Providers and Backends  
7. Queues  
8. Reservations and Scheduling  
9. Jobs and Dispatch  
10. Reconciliation  
11. Incidents  
12. Policies and Quotas  
13. Metering  
14. Audit and Evidence  
15. Administration and Settings  

**Per-module gate:** navigation, states, permissions, **no console errors**, browser screenshot; backend stub minimum or honest empty state.

## Phase 6 — Backend completion

**Order mirrors Priority 2→5:** projects/approvals → inventory/providers → dispatch/jobs → metering/audit/evidence.

| Gate G6 | Criteria |
| --- | --- |
| Migrations | Alembic head matches models |
| Guards | Every new route permission-coded |
| Tests | Integration test per router |
| Lab deprecation | Remove lab stub when production path ships |

**Blockers:** Provider credentials, quantum lab hardware, OpenStack for Blazar parity tests.

## Phase 7 — Integration

- TanStack Query mutations invalidate correct keys.
- CSRF on all unsafe methods.
- Role matrix tested (operator vs admin vs PI).

## Phase 8 — Validation

- `make check` green.
- Playwright workspace suite.
- Manual workflow: Submit → Evidence on **test adapter** data.
- `IMPLEMENTATION_LOG.md` module reports.

## Honest blockers (rolling)

| ID | Blocker | Mitigation |
| --- | --- | --- |
| B1 | No governance APIs in prod | Phase 6 before claiming page “done” |
| B2 | XDMoD/OnDemand not runnable locally | Pattern docs + optional archived tutorial |
| B3 | Horizon not cloned | Blazar + QRP LLD for inventory |
| B4 | AGPL/GPL references | Pattern-only adoption |
| B5 | MFA UI partially stubbed | Identity phase alignment |

## Recommended next module (post Phase 1 review)

**Phase 3 (design system) + Phase 5.1 (Home)** — establishes KPI/data contracts that drive Priority 2 APIs (governance summary, operations centre).
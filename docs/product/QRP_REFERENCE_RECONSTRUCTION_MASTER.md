# QRP — Reference-driven full-stack reconstruction (canonical Cursor prompt)

**Use this** at the start of reconstruction sessions after reading `docs/reference-analysis/`.

## Mission

Transform QRP into an enterprise-grade **quantum resource governance, orchestration, and operations** platform by studying cloned OSS references and the live QRP codebase — **not** by restyling pages without backend truth.

## Hard constraints

| Do | Do not |
| --- | --- |
| Study `vendor-references/` source (grep, models, routes) | Merge vendor code into `frontend/src` or `backend/qre` |
| Preserve cookie sessions, CSRF, RBAC, `/rbac/audit` | Second auth system or localStorage sessions |
| Implement module-by-module with APIs | Ship attractive UI on 404/lab-only data |
| Log in `docs/reference-analysis/IMPLEMENTATION_LOG.md` | Cosmetic-only passes before Phase 3 approval |
| Use FastAPI + PostgreSQL + Alembic patterns already in repo | Replace stack without ADR |

## Phases

1. **Reference research** — docs under `docs/reference-analysis/`  
2. **QRP audit** — per-route API/UI classification  
3. **Design system** — shared components, layout law  
4. **Application shell** — nav, notifications, chrome  
5. **Frontend reconstruction** — Home → Settings (15 modules)  
6. **Backend completion** — Priority 2→5 services  
7. **Integration** — Query wiring, mutations  
8. **Validation** — tests, browser QA, RBAC matrix  

## Priorities (backend/frontend pairing)

1. Foundation — auth, shell, components, contracts  
2. Core governance — projects, workloads, approvals, quotas  
3. Quantum infrastructure — inventory, providers, pools, queues, reservations  
4. Execution — jobs, dispatch, reconcile, incidents  
5. Accountability — metering, audit, evidence, reporting  

## Workflow law

Lifecycle: **Submit → Review → Authorise → Schedule hold → Dispatch → Evidence**.  
Contextual step rail on **detail + wizards only** — not global on list pages.

## Quality gates (summary)

Per route: real API or honest empty/error; permissions; breadcrumbs; no fake metrics; a11y; responsive; no console errors.  
Per API: migration, schema, guard, validation, audit, tests.

## Research outputs (maintain)

- `REFERENCE_REPOSITORY_INVENTORY.md`
- `REFERENCE_FRONTEND_ANALYSIS.md` / `REFERENCE_BACKEND_ANALYSIS.md`
- `REFERENCE_COMPONENT_CATALOG.md`
- `REFERENCE_WORKFLOW_MAPPING.md`
- `repositories/*.md` per vendor

## Working style

Complete **one module** (frontend + backend where required) before the next. Refer back to vendor source when designing components. Show user architecture after Phase 1 before mass UI changes.

**End state:** Unified QRP product — ColdFront governance + OnDemand execution + Blazar/LibreBooking reservations + XDMoD metering + qBraid quantum adapters — with QRP’s own design language (`docs/product/DESIGN.md` wins over reference palettes).
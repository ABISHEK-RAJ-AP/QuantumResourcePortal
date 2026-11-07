# Decision log

Decisions that the reference documents leave open, or where the master prompt and the LLD differ. Full context is in `00_REQUIREMENTS_AND_DESIGN.md` §6–§7.

Status: **Proposed** = default I am building toward until told otherwise. **Applied** = already in code.

| ID | Decision | Status | Default |
|---|---|---|---|
| X-1 | Browser auth: JWT vs server session | Applied (Phase 3 builds it) | Opaque `qre_sid` session cookie + CSRF token, per LLD §4.3/§11.3 |
| X-2 | Primary keys | Applied | 26-char ULID `CHAR(26)` (HLD §7.2) |
| X-3 | SQLAlchemy line | Applied | 2.0.x async with asyncpg |
| X-4 | Backend folder layout | Applied | LLD vertical slices `qre/services/svcNN_<name>/` |
| D-01 | SVC-05 procurement/entitlements (OI-01) | Proposed | Build fully; flag off in `.env.example`, on in demo profile |
| D-02 | Default approval policy (OQ-02) | Proposed | 2 stages: PROJECT_OWNER (48 h) → QUOTA_APPROVER (72 h), escalate to PLATFORM_ADMIN |
| D-03 | Quota units/periods (OQ-03) | Proposed | shots, qpu_seconds, cpu_core_hours, gpu_hours, storage_gb_days; monthly |
| D-04 | Ticket priority/severity/assignee | Proposed | Additive columns, marked QRP extension pending LLD amendment |
| D-05 | Notification read state | Proposed | Additive `notification.read_at` + read endpoints, marked extension |
| D-06 | Asset deletion | Proposed | No hard delete; Deactivate = `RETIRED` |
| D-07 | Quota ledger endpoints | Proposed | Additive `/quota-ledgers` endpoints |
| D-08 | "Inventory exception" definition | Proposed | Invalid import jobs + assets on locked/blocked backends or suspended/retired providers |
| D-09 | Dispatch permission and connectors (OQ-04/05) | Proposed | PROJECT_OWNER + PLATFORM_ADMIN; only a `demo-noop` connector for simulators; hardware submit not verified |
| D-10 | Frontend packaging | Applied | Single Vite app with internal ui/api split |
| D-11 | "Asset Details" sidebar item | Proposed | Replaced by "Import Assets"; details open from inventory rows |
| D-12 | PDF library | Proposed | reportlab |
| D-13 | MFA / federation (OI-05) | Proposed | Local login only in lab; OIDC/SAML/TOTP shown as not configured |
| D-14 | Row-level security (PD-44) | Proposed | Repository predicate always; RLS behind `QRE_RLS_ENABLED=false` |
| D-15 | Audit chain head table missing from App. B | Proposed | Advisory lock + latest row hash; no new table |
| D-16 | Demo data separation | Proposed | Separate `DEMO` tenant flagged `demo_data=true`; seed refuses production |
| P1-a | Unhandled-exception responses | Applied | Built by CorrelationMiddleware so 500s carry the correlation id |
| P1-b | HTTP 405 mapping (no catalogue code) | Applied | Problem body code `MALFORMED_REQUEST`, HTTP status kept at 405 |
| P1-c | Brand vs shadcn tokens | Applied | shadcn `--accent`/`--secondary` are subtle tints; brand violet/cyan exposed as `--brand-violet`/`--brand-cyan` |
| P1-d | Fonts | Applied | Self-hosted via @fontsource (LLD CSP allows only `'self'`) |

## RBAC decisions (05-Nov-2026)

Context: `RBAC_IMPLEMENTATION_PLAN.md` §12. **Approved** = confirmed by the project owner on 05-Nov-2026; not yet in code.

| ID | Decision | Status | Default |
|---|---|---|---|
| R-01 | DB-managed roles/permissions vs LLD fixed role codes + `permissions.yaml` | Approved | Hybrid: `role`, `permission`, `role_permission` tables; 9 LLD roles seeded as immutable system roles; PLATFORM_ADMIN creates tenant custom roles; LLD change request |
| R-02 | Permission identifier style | Approved | LLD `resource:action` (e.g. `asset:create`) |
| R-03 | Super Administrator role | Proposed | Not introduced; installer `bootstrap` command per tenant |
| R-04 | Support Administrator role | Proposed | Not introduced; OPERATOR triages tickets; may be a custom role |
| R-05 | User create/deactivate endpoints | Proposed | Additive `/admin/users` (PLATFORM_ADMIN), marked extension |
| R-06 | Self-registration | Approved | No role choice; creates `PENDING` user without roles; off in production unless enabled |
| R-07 | Backend that serves the existing module pages | Approved (partial) | Build RBAC here now (RBAC-2…6); module ownership still to be decided before RBAC-7 |
| R-08 | Researcher read of asset catalogue | Proposed | Tenant-wide catalogue read; project-only for workloads/usage/reservations |
| R-09 | Pools, alerts, incidents (not QRP SVCs in LLD) | Proposed | Permissions defined; enforced where their backend lives |
| R-10 | PROVIDER_ADMIN creating a new provider | Proposed | Creator auto-assigned PROVIDER_ADMIN of the DRAFT provider, audited |
| R-11 | Project creation in QRP | Proposed | PLATFORM_ADMIN only |
| R-12 | D-02 escalation vs LLD (PA cannot decide approvals) | Proposed | Escalation notifies PA to reassign; PA does not decide |
| R-13 | Reservation confirmation | Proposed | PLATFORM_ADMIN and OPERATOR |
| R-14 | Usage adjustment / report export | Proposed | As in plan §4 matrix |
| R-15 | Entitlement grant | Proposed | RESOURCE_MANAGER, QUOTA_APPROVER, PLATFORM_ADMIN |
| R-16 | Response for out-of-scope (cross-project) ids | Proposed | 404 if no read on the resource; 403 if visible but not actionable |
| R-17 | LLD `uq_role_assignment_1` blocks re-grant, allows NULL-scope duplicates | Proposed | Partial unique index on active rows with `COALESCE(scope_id,'*')`; LLD change request |
| R-18 | `permissions.yaml` parser | Proposed | Add `PyYAML`; alternative: JSON file, no new dependency |

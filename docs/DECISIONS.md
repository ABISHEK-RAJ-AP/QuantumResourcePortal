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

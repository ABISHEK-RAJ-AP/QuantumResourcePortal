# QRP RBAC — Requirement Traceability

**Date:** 05-Nov-2026 · **Phase:** RBAC-1 · Companion to `RBAC_IMPLEMENTATION_PLAN.md` (§ references below are to that plan).
Status values: **Planned** (designed, not built) · **Built** · **Verified** (tests green) · **Pending decision** (blocked on R-xx).

## 1. SRS and LLD requirements

| Req | Source text (abridged) | Design (plan §) | Implementation (planned files) | Verification | Status |
|---|---|---|---|---|---|
| REQ-001 | Shell routes authenticated users to workspaces without separate login | §7.3 session cookie, §8.1 AuthProvider | `svc02_identity/service.py`, `auth/AuthProvider.tsx` | TC-SHL-001 (QRP part) | Planned |
| REQ-002 | Navigation reflects server-derived roles; no access to unauthorized modules | §5.2 `can()`, §7.2 `/me/navigation`, §8.4 | `NavigationBuilder`, `chrome.tsx`, `routePermissions.ts` | TC-SHL-002; Vitest sidebar tests | Planned |
| REQ-003 | Versioned JSON APIs only; UI never contradicts server | §8.1 single client, §8.2 gates as UX only | `api/client.ts`, retire `api/qre.ts` | TC-SHL-003 (static scan) | Planned |
| REQ-005 | Authenticate users; federation when configured | §7.3 local login; federation tables now, endpoints per D-13 | `svc02_identity/*`, migration 0002 | TC-IAM-001 (local part) | Planned / federation deferred (D-13) |
| REQ-006 | Derive roles and tenant scope from trusted data on each API call | §5.1, §5.4 per-request derivation; §9 S-1 | `core/context.py`, `core/authz.py`, `core/deps.py` | TC-IAM-002; `test_role_header_ignored` | Planned |
| REQ-007 | Generic failed-login error | §7.3 dummy hash, identical body | `AuthService.login_local` | TC-IAM-003 | Planned |
| REQ-008 | Audit login, approvals, credential changes, exports | §6.1 `audit_log`, §9 S-12 | `svc17_audit/*`, migration 0004 | TC-AUD-001 | Planned |
| REQ-009 | Deny cross-tenant access (403/404 per policy) | §5.2 step 3 → 404; R-16 cross-project | `BaseRepository`, `Authorizer.require` | TC-IAM-009; `test_idor.py` | Planned |
| REQ-N011 | Lockout after repeated failures | §7.3 PD-12 values | `AuthService`, `login_attempt` | TC-IAM-004 | Planned |
| REQ-N012 | Tenant isolation on every sensitive read/write | §5.2, §6 tenant FK on every table; RLS per D-14 | `core/db.py` BaseRepository | TC-IAM-009 | Planned |
| REQ-N013 | Configurable idle timeout; expired sessions rejected | §7.3 | `SessionRepo`, `get_ctx` | TC-IAM-005 | Planned |
| REQ-N014 | Logout invalidates server session | §7.3 | `AuthService.logout` | TC-IAM-006 | Planned |
| REQ-N015 | Service identities distinct from humans | §6.1 `service_identity`; `ASSISTANT` not human-assignable | migration 0002; `policies.py` | TC-IAM-007 | Planned (table only) |
| REQ-N016 | Production MFA documented and enforced | D-13 deferred; config flag exists | `config.py` | TC-IAM-008 | Pending (D-13) |
| REQ-D004 | Secrets and password hashes never in API/logs | §9 S-13 DTO allow-lists | `schemas.py`, `core/logging.py` (exists) | TC-AUD-002 | Planned |
| REQ-V003 | Security tests: unauthorized admin access, cross-tenant reads | §10 security suite | `tests/security/*` | TC-IAM-009, TC-IAM-010 | Planned |
| SRS App. B | Normative role matrix, least privilege, default deny; may not be reduced | §3, §4 matrix; R-01 system roles immutable at runtime | `permissions.yaml`, migration 0005 | Generated matrix test (every cell allow + deny) | Planned |
| SRS App. B (resource table) | Project read/write by membership; approval by stage role; manifest by assigned provider; inventory by resource manager | §4, §5.2 scope coverage | `Authorizer`, `role_assignment` scopes | `test_authz.py` scope cases | Planned |
| LLD §11.2 | Authorizer = role in scope ∧ resource in tenant ∧ state guard | §5.2 | `core/authz.py` | `test_authz.py` | Planned |
| LLD §4.3.2 (4) | Role revocation bumps `membership_version` | §5.4 | `AssignmentService.revoke` | TC-IAM-002 | Planned |
| LLD §4.7 / PD-25 | Submitter cannot decide own workload | §9 S-8 | `policies.py` now; SVC-06 later | `test_rbac_policies.py`; TC-QRP-007 later | Planned |
| LLD §11.3 | HttpOnly `qre_sid`, CSRF, rotation | §7.3 | `middleware/csrf.py`, `security.py` | `test_csrf.py`, TC-IAM-005/006 | Planned |
| LLD §11.6 | No tokens in localStorage | §8.1 remove `lib/session.ts` | frontend auth rework | Vitest + static scan | Planned |
| LLD App. F | ROLE_GRANTED, ROLE_REVOKED, AUTHZ_DENIED, LOGIN_*, LOGOUT | §6.1, §9 S-17 | `svc17_audit/service.py` | `test_audit.py` | Planned |

## 2. Master-prompt requirements

| Master prompt § | Requirement | Plan § | Status / note |
|---|---|---|---|
| §1 | Create plan, traceability, status docs before implementation | this set | Built (docs) |
| §3 | Users, roles, permissions, role-permission, user-role, scopes, tenant isolation, admin, audit | §3–§6 | Planned |
| §3 | Deny by default; backend enforcement independent of UI | §5.2, §5.3 route-guard check | Planned |
| §4 | Role definitions (name, description, scope, allowed, restricted) | §3 | Built (design); Super/Support Admin not introduced (R-03, R-04) |
| §5 | Granular permissions per module with action categories | §4 | Built (design); identifier style R-02 |
| §6 | Normalized schema, constraints, indexes, timestamps, actor refs, soft delete, ER diagram, Alembic | §6 | Planned; R-01, R-17 |
| §6.4 | Prevent removal of last admin | §6.3, §9 S-7 | Planned |
| §7 | Repositories/services/dependencies `require_permission` etc. | §5.3, §7.1 | Planned |
| §7 | Role, permission, user-role, authorization APIs | §7.2 | Planned |
| §7 | 401 vs 403 | §5.2 | Planned (+404 for out-of-scope ids, LLD §11.4) |
| §8 | Integrate with existing authentication | §7.3 | No authentication exists in this backend; LLD SVC-02 is built. Frontend's current login targets an external API (R-07) |
| §8.9 | Handle permission changes without stale data | §5.4 | Planned |
| §9 | Screens A–G | §8.3 | Planned |
| §10 | `usePermissions`, `useHasPermission`, `useHasRole`, `ProtectedRoute`, `PermissionGate`; direct URL → access denied | §8.2, §8.4 | Planned |
| §11 | Integrate all existing QRP modules | §8.4 frontend; backend per module | **Pending R-07** — backend modules do not exist in this repo |
| §12 | Security list (escalation, IDOR, mass assignment, …) | §9 | Planned |
| §13 | Audit events, protected logs, reuse existing audit | §6.1 `audit_log` (LLD), §9 S-12 | Planned; no audit service existed to reuse |
| §14 | Backend, frontend, e2e tests (allowed and denied) | §10 | Planned |
| §15 | VS Code workflow per phase | §13 commands; per-phase guide in RBAC-10 | Planned |
| §17 | Do not grant all permissions to admins | §3 (PA lacks `approval:decide`) | Built (design) |
| §17 | Do not silently resolve pending decisions | §12 R-01…R-18 | Built (logged) |

## 3. Test-case coverage map (LLD §14.11)

| Test case | What it proves | RBAC phase |
|---|---|---|
| TC-IAM-002 | Role removed after login → 403 on next request | RBAC-4 |
| TC-IAM-003 | Unknown user vs wrong password indistinguishable | RBAC-4 |
| TC-IAM-004 | Lockout at 5 failures | RBAC-4 |
| TC-IAM-005 | Idle timeout → `AUTH_SESSION_EXPIRED` | RBAC-4 |
| TC-IAM-006 | Logout → old cookie unusable | RBAC-4 |
| TC-IAM-007 | Service principals separate | RBAC-3 (inspection) |
| TC-IAM-009 | Cross-tenant id → 404; tenant filter tampering ignored | RBAC-8 |
| TC-IAM-010 | RESEARCHER on admin endpoints → 403 + `AUTHZ_DENIED` | RBAC-5 / RBAC-8 |
| TC-SHL-002 | RESEARCHER: approvals absent from navigation and 403 on API | RBAC-5 / RBAC-6 |
| TC-AUD-001 | Audit rows + chain verifies | RBAC-4 |
| TC-AUD-002 | No secrets in responses/logs | RBAC-4 |

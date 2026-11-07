# QRP RBAC — Permission Matrix (generated)

> **Generated from `backend/permissions.yaml` by `backend/scripts/validate_permissions.py`. Do not edit by hand** —
> change the YAML and re-run. This file is the human-readable view of the RBAC-3 seed.

- Identifier style: `resource:action` (R-02) · Catalogue version: 1
- **70 permissions** across **25 modules**, **8 assignable system roles** (+ ASSISTANT service identity, no permissions).
- Legend: **✓** held tenant-wide · **P** held within an assigned project · **V** held within an assigned provider · **—** denied.
- Scope comes from each role's `assignable_scope`; the Authorizer narrows a grant to the assignment's project/provider at request time (plan §5.2).

## Roles

| Code | Name | Scope | Permissions | Summary |
|---|---|---|---:|---|
| `PLATFORM_ADMIN` | Platform Administrator | TENANT | 69 | Connectors, credentials, schedules; provider state; policies; tenant membership admin; custom roles; user lifecycle; settings; audit read + verify. Does NOT decide approvals. |
| `OPERATOR` | Operator | TENANT | 26 | Read QRP; manual dispatch reconciliation; reservations; ticket triage; alert ack/resolve. |
| `RESEARCHER` | Researcher / Standard User | PROJECT | 19 | Create, submit and withdraw own project's workloads; reserve in project; read project data and catalogue. Cannot approve; cannot see the approval queue. |
| `PROJECT_OWNER` | Project Owner / Project Administrator | PROJECT | 30 | Researcher rights plus stage-1 approvals where assigned, project membership admin (project-scoped roles only), dispatch, and project audit read/export. Cannot decide own workloads (SoD). |
| `QUOTA_APPROVER` | Quota Approver | TENANT | 21 | Stage-2 (quota/policy) approvals; authorise/re-authorise; quota ledger maintenance; entitlement read/grant. Cannot decide own workloads (SoD). |
| `PROVIDER_ADMIN` | Provider Administrator | PROVIDER | 10 | Create provider (DRAFT); submit onboarding/manifests for own provider; read own provider's backends and connectors. Cannot transition provider state. |
| `AUDITOR` | Auditor | TENANT | 29 | Read everything in QRP; audit read, export and chain verification. No writes. |
| `RESOURCE_MANAGER` | Resource Manager | TENANT | 23 | Inventory create/update/retire/import, topology, procurement, entitlements, SLA targets. Pending NF-01/CF-09 — kept as specified in LLD. Cannot approve or manage roles. |
| `ASSISTANT` | Assistant (service) | PROJECT | 0 | SVC-19 drafting identity. No QRP permissions (REQ-062). |

## Matrix

| Module | Permission | PA | OP | RS | PO | QA | PV | AU | RM | Basis |
|---|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|---|
| Governance dashboard | `governance:read` | ✓ | ✓ | P | P | ✓ | V | ✓ | ✓ | API-GOV-01; SRS App.B QRP R |
| User management | `user:read` | ✓ | — | — | P | — | — | ✓ | — | ext R-05 |
|  | `user:create` | ✓ | — | — | — | — | — | — | — | ext R-05 |
|  | `user:update` | ✓ | — | — | — | — | — | — | — | ext R-05 |
| Role assignment (memberships) | `membership:read` | ✓ | — | — | P | — | — | ✓ | — | API-IAM-07 |
|  | `membership:admin` | ✓ | — | — | P | — | — | — | — | API-IAM-07; LLD §11.2 |
| Role management | `role:read` | ✓ | — | — | — | — | — | ✓ | — | ext R-01 |
|  | `role:create` | ✓ | — | — | — | — | — | — | — | ext R-01 |
|  | `role:update` | ✓ | — | — | — | — | — | — | — | ext R-01 |
|  | `role:delete` | ✓ | — | — | — | — | — | — | — | ext R-01 |
| Permission catalogue | `permission:read` | ✓ | — | — | — | — | — | ✓ | — | ext R-01 |
| Projects | `project:read` | ✓ | ✓ | P | P | ✓ | — | ✓ | ✓ | API-PRJ-01; SRS App.B |
|  | `project:create` | ✓ | — | — | — | — | — | — | — | R-11 |
|  | `project:update` | ✓ | — | — | P | — | — | — | — | LLD §11.2 project:write |
| Resource inventory | `asset:read` | ✓ | ✓ | P | P | ✓ | V | ✓ | ✓ | API-INV-01 readers; R-08 |
|  | `asset:create` | ✓ | — | — | — | — | — | — | ✓ | API-INV-01; LLD asset:write |
|  | `asset:update` | ✓ | — | — | — | — | — | — | ✓ | API-INV-01 |
|  | `asset:retire` | ✓ | — | — | — | — | — | — | ✓ | D-06 |
|  | `asset:import` | ✓ | — | — | — | — | — | — | ✓ | API-INV-02 |
|  | `topology:write` | ✓ | — | — | — | — | — | — | ✓ | API-INV-04 |
| Resource pools *(deferred — R-09)* | `pool:read` | ✓ | ✓ | P | P | — | — | ✓ | ✓ | R-09 (frontend module) |
|  | `pool:manage` | ✓ | — | — | — | — | — | — | ✓ | R-09 |
| Provider management | `provider:read` | ✓ | ✓ | P | P | ✓ | V | ✓ | ✓ | SRS App.B QRP R |
|  | `provider:create` | ✓ | — | — | — | — | V | — | — | API-PRV-01; R-10 |
|  | `provider:manifest:write` | ✓ | — | — | — | — | V | — | — | API-PRV-02; LLD §11.2 |
|  | `provider:state:transition` | ✓ | — | — | — | — | — | — | — | API-PRV-03; REQ-036 |
| Backends | `backend:read` | ✓ | ✓ | P | P | ✓ | V | ✓ | ✓ | LLD §11.2 backends:read |
| Connectors | `connector:read` | ✓ | ✓ | — | — | — | V | ✓ | — | SRS App.B (OP/AU/PV) |
|  | `connector:configure` | ✓ | — | — | — | — | — | — | — | API-CON-01..05 |
|  | `connector:credential:rotate` | ✓ | — | — | — | — | — | — | — | API-CON-02 |
| Approval policies | `policy:read` | ✓ | ✓ | P | P | ✓ | — | ✓ | ✓ | SRS App.B QRP R |
|  | `policy:publish` | ✓ | — | — | — | — | — | — | — | API-APR-05 |
| Quotas | `quota:read` | ✓ | ✓ | P | P | ✓ | — | ✓ | — | SRS App.B |
|  | `quota:manage` | ✓ | — | — | — | ✓ | — | — | — | D-07 |
| Workloads | `workload:read` | ✓ | ✓ | P | P | ✓ | — | ✓ | — | API-APR-02 |
|  | `workload:create` | ✓ | — | P | P | — | — | — | — | API-WKL-01; LLD §11.2 |
|  | `workload:submit` | ✓ | — | P | P | — | — | — | — | API-WKL-03; LLD §11.2 |
|  | `workload:withdraw` | ✓ | — | P | P | — | — | — | — | API-WKL-03; HLD §8.1 |
| Approvals | `approval:read` | ✓ | — | — | P | ✓ | — | ✓ | — | API-APR-01/02; TC-SHL-002 |
|  | `approval:decide` | — | — | — | P | ✓ | — | — | — | LLD §11.2 (PO stage-1, QA stage-2); PD-25 SoD |
|  | `workload:authorize` | ✓ | — | — | — | ✓ | — | — | — | API-APR-04 |
| Reservations / scheduling | `reservation:read` | ✓ | ✓ | P | P | ✓ | — | ✓ | — | API-SCH-01 |
|  | `reservation:create` | ✓ | ✓ | P | P | — | — | — | — | API-SCH-01 |
|  | `reservation:cancel` | ✓ | ✓ | P | P | — | — | — | — | API-SCH-01 |
| Dispatch & reconciliation | `dispatch:read` | ✓ | ✓ | P | P | — | — | ✓ | — | API-EXE-02/05 |
|  | `workload:dispatch` | ✓ | — | — | P | — | — | — | — | API-EXE-01; PD-39/D-09 |
|  | `dispatch:reconcile` | ✓ | ✓ | — | — | — | — | — | — | API-EXE-03 |
| Usage metering | `usage:read` | ✓ | ✓ | P | P | ✓ | — | ✓ | ✓ | API-MTR-01 QRP roles |
|  | `usage:adjust` | ✓ | — | — | — | — | — | — | — | App.F USAGE_ADJUSTED; R-14 |
|  | `report:export` | ✓ | — | — | P | ✓ | — | ✓ | ✓ | API-RPT-01; R-14 |
| SLA management | `sla:read` | ✓ | ✓ | — | — | ✓ | V | ✓ | ✓ | API-MTR-02 readers |
|  | `sla:target:write` | ✓ | — | — | — | — | — | — | ✓ | API-MTR-02 |
| Procurement references *(flag: QRE_FEATURE_SVC05_ENABLED)* | `procurement:read` | ✓ | — | — | — | ✓ | — | ✓ | ✓ | API-PRC-01 |
|  | `procurement:write` | ✓ | — | — | — | — | — | — | ✓ | LLD §11.2 |
| Entitlements *(flag: QRE_FEATURE_SVC05_ENABLED)* | `entitlement:read` | ✓ | — | — | P | ✓ | — | ✓ | ✓ | API-PRC-03 |
|  | `entitlement:grant` | ✓ | — | — | — | ✓ | — | — | ✓ | API-PRC-03; R-15 |
| Support tickets | `ticket:read` | ✓ | ✓ | P | P | ✓ | V | ✓ | ✓ | API-SUP-01 |
|  | `ticket:create` | ✓ | ✓ | P | P | ✓ | V | — | ✓ | API-SUP-01 |
|  | `ticket:update` | ✓ | ✓ | — | — | — | — | — | — | R-04 |
|  | `ticket:escalate` | ✓ | ✓ | — | — | — | — | — | — | R-04 |
| Incidents / alerts *(deferred — R-09)* | `alert:read` | ✓ | ✓ | — | — | — | — | ✓ | — | LLD §11.2 (Q-TeleScope) |
|  | `alert:ack` | ✓ | ✓ | — | — | — | — | — | — | LLD §11.2 |
|  | `alert:resolve` | ✓ | ✓ | — | — | — | — | — | — | LLD §11.2 |
|  | `incident:read` | ✓ | ✓ | — | — | — | — | ✓ | — | LLD §11.2 |
|  | `incident:manage` | ✓ | ✓ | — | — | — | — | — | — | LLD §11.2 |
| Audit logs | `audit:read` | ✓ | — | — | P | — | — | ✓ | — | API-AUD-01; LLD §11.2 |
|  | `audit:export` | ✓ | — | — | P | — | — | ✓ | — | SRS App.B Audit export |
|  | `audit:verify` | ✓ | — | — | — | — | — | ✓ | — | API-AUD-01 |
| System settings | `settings:read` | ✓ | — | — | — | — | — | ✓ | — | repo nav map |
|  | `settings:write` | ✓ | — | — | — | — | — | — | — | repo nav map |

## SRS Appendix B validation

Every normative SRS Appendix B cell below is satisfied by the permissions shown (checked by the validator; the build fails if any is reduced).

| SRS Appendix B cell | Roles | Satisfied by |
|---|---|---|
| Platform administrator — QRP: A | PLATFORM_ADMIN | `governance:read`, `asset:create`, `provider:state:transition`, `policy:publish`, `membership:admin`, `settings:write` |
| Operator — QRP: R | OPERATOR | `governance:read`, `asset:read`, `workload:read` |
| Researcher/developer — QRP: R (project) | RESEARCHER | `governance:read`, `asset:read`, `workload:read` |
| Project owner — QRP: R/W approvals (stage 1) | PROJECT_OWNER | `approval:read`, `approval:decide` |
| Quota approver — QRP: R/W approvals (stage 2) | QUOTA_APPROVER | `approval:read`, `approval:decide`, `workload:authorize` |
| Provider administrator — QRP: R/W manifests | PROVIDER_ADMIN | `provider:read`, `provider:manifest:write` |
| Auditor — QRP: R; Audit export: R | AUDITOR | `governance:read`, `asset:read`, `audit:read`, `audit:export` |
| Project — read/write — project membership role | PLATFORM_ADMIN, PROJECT_OWNER | `project:read`, `project:update` |
| Workload — submit for review — project permission | RESEARCHER, PROJECT_OWNER, PLATFORM_ADMIN | `workload:submit` |
| Workload — dispatch — approval + quota policy | PROJECT_OWNER, PLATFORM_ADMIN | `workload:dispatch` |
| Approval — approve/reject — approver role for stage | PROJECT_OWNER, QUOTA_APPROVER | `approval:decide` |
| Provider manifest — create/update — provider administrator | PROVIDER_ADMIN, PLATFORM_ADMIN | `provider:manifest:write` |
| Connector credential — rotate/test — platform administrator | PLATFORM_ADMIN | `connector:credential:rotate`, `connector:configure` |
| Audit/export — export — audit export policy | AUDITOR, PLATFORM_ADMIN, PROJECT_OWNER | `audit:export` |
| Inventory asset — read/write — resource manager role | RESOURCE_MANAGER, PLATFORM_ADMIN | `asset:read`, `asset:create`, `asset:update` |

## Invariants

- **Deny by default:** True.
- **PLATFORM_ADMIN must not hold:** `approval:decide` — enforced so administrators cannot decide approvals (separation of duties, LLD §11.2).

## Privileged permissions

Grantable only by `PLATFORM_ADMIN`; guarded by the anti-escalation policy (plan §9, S-2):

`user:create`, `user:update`, `membership:admin`, `role:create`, `role:update`, `role:delete`, `project:create`, `pool:manage`, `provider:state:transition`, `connector:configure`, `connector:credential:rotate`, `policy:publish`, `quota:manage`, `usage:adjust`, `entitlement:grant`, `audit:export`, `settings:write`


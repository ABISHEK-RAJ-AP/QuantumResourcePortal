# QRP end-to-end workflow (canonical)

**Stages are separate decisions.** Do not collapse project approval, workload approval, quota grant, reservation hold, and dispatch authorisation into one status field.

## Lifecycle chain

```text
Project → Workload draft → Submit for review → Approval decision
  → Quota evaluation → Reservation (optional) → Schedule/eligibility
  → Dispatch attempt(s) → Provider execution → Results → Metering
  → Reconciliation → Evidence + governance audit
```

| Stage | Actor | Permission(s) | Backend today | Notes |
| --- | --- | --- | --- | --- |
| Create project | Researcher / admin | `project:create` | **svc03** POST `/projects` | No project-approval FSM yet |
| Project membership | Owner / admin | `membership:admin` | **svc03** GET/POST `/projects/{id}/members` | editor→RESEARCHER, viewer→PROJECT_VIEWER |
| Workload draft | Researcher | `workload:create` | **svc06** POST submissions | Wizard in modal |
| Submit for review | Researcher | `workload:submit` | **svc06** submit-for-review | Creates workload row |
| Approval queue | Reviewer | `approval:read` | **svc06** GET `/approvals` | Scoped by project |
| Decide | Reviewer | `approval:decide` | **svc06** POST decide | SoD: not own workload |
| Withdraw | Researcher | `workload:withdraw` | **svc06** POST withdraw | |
| Quota evaluate | System / reviewer | `quota:read` | **svc05** `GET /quotas/evaluate` | Daily cap check before approve |
| Quota ledger | Accountant | `quota:read` | **svc05** `GET /quotas/ledger` | Approved workloads + metadata shots |
| Reservation hold | Researcher | `reservation:create` | **svc07** | Overlap → `has_conflict` |
| Reservation activate/release | Operator / owner | `reservation:create/cancel` | **svc07** transition FSM | requested→active→released |
| Backend compatibility | System | — | **missing** | qBraid-style capability check |
| Dispatch attempt | Operator | `dispatch:*` | **shipped** svc08 | Authorize → record → reconcile |
| Job tracking | Researcher | `dispatch:read` | **shipped** svc08 | Provider job id on confirm |
| Metering | System | `usage:read` | **missing** | Append-only usage rows |
| Reconciliation | Operator | `dispatch:reconcile` | UI only | Match allocation/reservation/usage |
| RBAC audit | Admin | `audit:read` | **svc17** `/rbac/audit` | Identity/admin only |
| Governance audit | Auditor | `governance:read` | **missing** `audit-events` | Project/approval/reservation events |

## State machines (enforced in service layer)

### Workload governance (`svc06`)

States include `draft` → `submitted_for_review` → `approved` / `rejected` / `changes_requested` / withdrawn paths. Transitions validated in `svc06_approvals/service.py`.

### Reservation (`svc07`)

| State | Next |
| --- | --- |
| `requested` | `active`, `cancelled` |
| `active` | `released`, `cancelled` |
| `released`, `cancelled` | (terminal) |

### Job / dispatch (target — not implemented)

Define explicitly before svc08: e.g. `accepted` → `queued` → `dispatched` → `running` → `completed` | `failed` | `cancelled`; dispatch attempts append-only with retry count.

## Preconditions (examples)

- Submit workload: project not archived; user has `workload:submit` on project.
- Decide approval: workload in reviewable state; reviewer not submitter where SoD applies.
- Create reservation: valid window; project scope for researchers; optional quota headroom (when evaluate exists).
- Dispatch: workload approved; quota pass; reservation active if policy requires; backend compatibility pass.

## Audit events (target governance audit)

Each consequential transition should emit: `actor_id`, `action`, `target_type`, `target_id`, `correlation_id`, `outcome`, no secrets in payload.

## Failure & cancellation

Every stage supports explicit failure or cancel paths (withdraw, cancel reservation, abort dispatch, mark job failed). No silent rollback of quota without accounting rule.

## Acceptance journey (J)

Used for E2E validation when P0–P1 slices exist — see `QRP_RECONSTRUCTION_SPIRIT.md` §Definition of done.
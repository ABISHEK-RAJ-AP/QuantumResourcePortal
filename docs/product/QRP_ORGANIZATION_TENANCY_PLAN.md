# QRP organization & tenancy model

**Status:** Phase 1 complete (lab self-registration + org-first UI); Phase 2 backlog below  
**Audience:** CDAC platform operators, customer org admins (startups, academia, PSUs, researchers)

## 1. Mental model (correct hierarchy)

| Layer | LLD term | User-facing label | Who |
| --- | --- | --- | --- |
| **Platform** | QRE deployment | Quantum Resource Portal | CDAC ops — shared providers, inventory, connectors |
| **Organization** | `tenant` | Organization | Each customer (startup, institute, student group, enterprise) |
| **Research project** | `project` | Project (optional) | Work container inside one org — approvals, quotas drill-down |
| **Person** | `app_user` + `role_assignment` | Member | Invited or created by org admin |

**Not a bug:** Metering rollups and daily shot **caps** are **organization-scoped** (`tenant_id`). The API dimension is `tenant`.  
**UX bug (being fixed):** Quotas and governance UI emphasized **projects** first, which reads as “project-wise billing” instead of org-wise service.

Projects remain required for workload submission (LLD SVC-06) but are **secondary** in navigation copy — org → people → projects → workloads.

## 2. Cert Studio reference (patterns to mirror)

| Cert Studio | QRP Phase 1 | QRP Phase 2 |
| --- | --- | --- |
| `/register` multi-step (org → user → security → verify) | Lab `POST /auth/register-organization` + stepped `/register` | Email verify + pending approval |
| `/register/find-org` join existing | Link to sign-in + “ask your org admin” | Join request queue |
| `/settings/organisation/*` people & invites | Settings **Organization** tab → Access hub | Dedicated `/qrp/settings/organization` |
| Org admin users / roles | `/qrp/admin/users` (Cert Studio Access hub) | Invite tokens, resend |
| Platform operator | `python -m qre bootstrap` for CDAC tenant | Cross-tenant **platform console** (approve org requests) |

## 3. CDAC as platform operator

1. **Bootstrap** CDAC org: `python -m qre bootstrap --tenant-code CDAC …` (platform catalog, demo seed).
2. **Customer orgs** are **separate tenants** — isolated data, own `PLATFORM_ADMIN`, own members.
3. CDAC staff use the CDAC tenant for provider/inventory ops; customers never see other tenants’ rows (app-layer `tenant_id`; RLS optional).
4. Phase 2: `org_registration_request` table + CDAC reviewer UI (not in Phase 1).

## 4. Phase 1 deliverables (this slice)

- [x] Plan (this doc)
- [x] `QRE_ORG_SELF_REGISTER` (lab default on, production off)
- [x] `POST /api/v1/auth/register-organization` → `bootstrap_admin` path
- [x] `/me` + session: `tenant_code`, `tenant_name`, `username`, `display_name`
- [x] `GET /me/organization` (Cert `/v1/orgs/me` analogue)
- [x] Capabilities: `self_registration` reflects flag
- [x] `/register` Cert-style workflow (org + admin user + password)
- [x] `/qrp/organization` hub (overview · people · invitations)
- [x] Nav **Organization** group; shell org chip + sidebar context
- [x] Settings **Organization** tab → hub; Access renamed **People & access**
- [x] Quotas: org-first labels; project table = optional breakdown
- [x] Projects page: subtitle clarifies “inside your organization”
- [x] UI reference bridge (`UI_REFERENCE_BRIDGE.md`): governance, ops, capacity, access, auth — org copy + `RelatedNav` → `/qrp/organization`

## 5. Phase 2 backlog

- Org join requests, invitation emails, account status page
- Platform admin: list tenants, approve/suspend orgs
- `tenant-switch` UI when users belong to multiple orgs (membership model extension)
- Metering: optional `by_project` rollups as drill-down (backend), not primary KPI

## 6. Verification

```bash
cd backend && pytest tests/integration/test_org_register.py -q
cd frontend && npm run typecheck
```

Manual: new org via `/register` → login → Settings shows org name → Quotas/Metering at org scope → create project under Projects.
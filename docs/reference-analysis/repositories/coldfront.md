# ColdFront (`vendor-references/coldfront`)

## Purpose

HPC **resource allocation** portal: PI projects, allocation requests/renewals, centre resources, staff approval workflows. National-lab style governance.

**Users:** PIs, researchers, HPC administrators, directors.

## Verified frontend stack

| Artifact | Finding |
| --- | --- |
| `pyproject.toml` | Django **4.2**, `django-htmx`, `crispy-bootstrap5` |
| `coldfront/static/package.json` | **Vite 7**, TypeScript, ESLint; `license: "AGPL-3.0-or-later"` |
| UI model | Server-rendered templates + HTMX partials — **not** a React SPA |

## Key directories

- `coldfront/core/project/` — projects, membership  
- `coldfront/core/allocation/` — requests, changes, renewals  
- `coldfront/core/resource/` — resource catalogue  
- `coldfront/plugins/api/` — DRF APIs  
- `coldfront/plugins/xdmod/` — usage reconciliation hooks  
- `coldfront/templates/common/` — role-specific navbars  

## Sample routes (code)

From `coldfront/core/allocation/urls.py`:

- `/allocation/request-list` — `allocation-request-list`  
- `/allocation/project/<pk>/create` — new request  
- `/allocation/<pk>/` — detail  
- `/allocation/change-list` — pending changes  

## Licence

**SPDX: AGPL-3.0-or-later** (`pyproject.toml`, `LICENSES/AGPL-3.0-or-later.txt`)

## Reusability for QRP

| Adopt (patterns) | Avoid |
| --- | --- |
| Project → allocation request IA | Copying templates or Django apps |
| DRF list/filter shapes for projects/allocations | Token auth as primary QRP auth |
| xdmod plugin “usage vs allocation” concept | AGPL merge |

## Limitations

Heavy Django deploy; plugins tie to Slurm/LDAP at real centres. UI is Bootstrap/HTMX — translate to QRP React ops density.

## QRP modules influenced

Projects, Approvals, Quotas, Policies, Home KPIs (pending allocations).
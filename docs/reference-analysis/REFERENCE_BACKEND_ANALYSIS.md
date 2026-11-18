# Reference backend analysis

Phase 1: **ColdFront** and **Open OnDemand**. QRP target remains **FastAPI** — patterns only.

---

## ColdFront

### Stack

| Component | Evidence |
| --- | --- |
| Framework | Django 4.2 WSGI (`pyproject.toml` classifiers) |
| API plugin | **Django REST Framework** — `coldfront/plugins/api/views.py` |
| Auth | Django users + DRF `Token`, session auth for browser |
| History | `django-simple-history` in API views |
| DB | PostgreSQL (typical deployment; models in `coldfront/core/*/models.py`) |

### API patterns (`coldfront/plugins/api/`)

| ViewSet | Serializer domain | QRP analogue |
| --- | --- | --- |
| `ResourceViewSet` | HPC resources | `provider` / `backend` registry |
| `AllocationViewSet` | Active allocations | Quota ledger |
| `AllocationRequestViewSet` | Pending requests | Workload submission queue |
| `AllocationChangeRequestViewSet` | Changes / renewals | Approval change pipeline |
| `ProjectViewSet` | Projects | `project` service |

Filters use `django-filter` (`FilterSet` classes in same module).

Token regeneration: `POST regenerate_token` (authenticated).

### Domain models (conceptual)

- **Project** — PI ownership, users, fields, grants  
- **Resource** — centre-defined capacity  
- **Allocation** — granted capacity on resource for project  
- **AllocationRequest** — approval workflow unit  

### Workflow engine

No separate BPMN engine — state transitions live in **models + admin/staff views**. QRP should implement explicit **approval state machine** in FastAPI (LLD) rather than Django signals.

### Security notes

- Staff vs non-staff nav separation in templates maps to RBAC — align with QRP `require_permission` codes, not Django `is_staff` alone.
- DRF token auth is **not** QRP’s cookie model — use for **field naming** and list/filter shapes only.

### Reusability

| Adopt | Avoid |
| --- | --- |
| Allocation request list filters | Merging Django apps |
| Project-scoped creation URLs | AGPL code copy |
| XDMoD plugin hook concept (`plugins/xdmod/`) | ColdFront session/token dualism in QRP |

---

## Open OnDemand

### Stack

| Component | Evidence |
| --- | --- |
| App server | Rails apps under `apps/*` |
| Job integration | Cluster config + scheduler adapters (not unified REST in dashboard) |
| Files | Controller actions proxying filesystem (permission-sensitive) |
| Shell | Node `express` router for web terminal |

### API / integration style

- **HTML-first** with Turbo Stream responses for job details (`format: 'turbo_stream'`).
- JSON under `files/...` update routes for editor integrations.
- Permissions via `Configuration.can_access_*` and `Authz::AppDeveloperConstraint`.

### QRP mapping

| OnDemand concern | FastAPI direction |
| --- | --- |
| Job status by cluster | `GET /api/v1/jobs?backend_id=` with adapter polling |
| Stop/delete job | `POST` with idempotency key + audit |
| Workflows | Stored definitions; dispatch service triggers provider |
| Multi-cluster | Provider adapter per backend (like MCAD multi-cluster) |

### Limitations

- No single OpenAPI document — integration is app-specific.
- QRP must define **one** OpenAPI contract per module (already started in LLD).

---

## Cross-reference: MCAD (dispatch backend)

See `repositories/codeflare.md` and `vendor-references/mcad` — **Go controller** queue/dispatch semantics for Priority 3–4, not OnDemand Rails.
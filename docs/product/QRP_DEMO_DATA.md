# QRP demonstration data (product contract)

**Canonical seed:** `backend/qre/seed/seed_demo.py`  
**CLI:** `python -m qre seed-demo --tenant-code <CODE>`  
**Lab API:** `POST /api/v1/admin/seed-demo` (PLATFORM_ADMIN)

## Minimum dataset (after full seed)

| Entity | Target | Stable id pattern |
| --- | ---: | --- |
| Projects | 10 | `DEMO-PRJ-0001` … `0010` |
| Providers | 6 | `demo-ibm`, `demo-ionq`, … |
| Backends | 15 | `demo-ibm-torino`, … |
| Workloads | 25+ | Linked submissions |
| Reservations | 20+ | `[DEMO]` purpose prefix |
| Jobs | 30+ | `demo-job-NNNN` |
| Dispatch attempts | 20+ | Tied to approved workloads |
| Alerts / incidents | sample | `[DEMO]` title prefix |

## Hero narrative

Project **`DEMO-PRJ-0001` (Quantum Materials Simulation)** owns an approved workload with shots/qubit metadata, reservation on `demo-ibm-torino`, dispatch attempt, provider job `demo-job-0001`, audit events, and quota ledger consumption (derived from approved workloads).

## Theme and UI

Preserve tokens in `frontend/src/styles/index.css` and `docs/product/QRP_DESIGN_SYSTEM.md`. Reference UI archaeology is **local only** (`docs/reference-analysis/`, gitignored). Do not commit vendor clones or reference-analysis trees.

Operator guide: `docs/development/QRP_DEMO_ENVIRONMENT.md`.
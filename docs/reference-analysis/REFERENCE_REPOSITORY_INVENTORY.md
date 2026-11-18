# Reference repository inventory

**Generated:** 2026-11-18 (Phase 1 — code inspection, not README-only)  
**Root:** `vendor-references/`  
**Clone script:** `vendor-references/clone-all.sh`

## Summary

| Folder | Cloned | Size | License (evidence) | Primary stack (manifest) | Local run feasibility |
| --- | --- | --- | --- | --- | --- |
| `coldfront` | Yes (shallow) | 47M | **AGPL-3.0-or-later** — `pyproject.toml`, `LICENSES/AGPL-3.0-or-later.txt` | Python ≥3.10, **Django 4.2**, DRF, HTMX; assets: Vite TS in `coldfront/static/` | **Medium** — Django + Postgres; no full HPC plugins required for UI grep |
| `ondemand` | Yes | 49M | **MIT** — `LICENSE.txt` | **Ruby on Rails** apps (`apps/dashboard`, `apps/myjobs`, `apps/shell`); JS: Bootstrap 5, DataTables, esbuild (`apps/dashboard/package.json`) | **Low** — needs configured cluster, LDAP, scheduler |
| `xdmod` | Yes | 169M | **LGPL-3.0** — `LICENSE` header | PHP + Node ETL (`etl/`), RPM/source install paths in `docs/` | **Low** — DB + Apache + batch ETL pipeline |
| `hpc-toolset-tutorial` | Yes | 262M | **LICENSE** (repo root; check file for terms) | Docker-compose tutorial wiring CF/OOD/XDMoD | **Low–Medium** — repo **archived** (README banner) |
| `blazar` | Yes | 3.7M | **Apache-2.0** — `pyproject.toml` | Python OpenStack service (`setup.py`, Oslo) | **Low** — requires OpenStack devstack/Kolla |
| `librebooking` | Yes | 49M | **GPL-3.0-only** — `composer.json`, `LICENSE.md` | PHP (`LibreBooking\` PSR-4), frontend lint via root `package.json` (Node ≥20.19) | **Medium** — `npm run test:e2e:up` (Docker) for UI |
| `qbraid` | Yes | 7.7M | **Apache-2.0** — `pyproject.toml` | Python SDK / API client patterns | **Medium** — SDK tests; portal UI not in this clone |
| `codeflare` | Yes | 2.8M | **Apache-2.0** — `setup.py` header | Python **Ray** pipelines library | **Medium** — Ray cluster for execution; not MCAD |
| `mcad` | Yes (added Phase 1) | 5.4M | **Apache-2.0** — README badge, `LICENSE` | **Go** Kubernetes controller (`multi-cluster-app-dispatcher`) | **Low** — needs K8s + quay images |
| `companyos` | Yes | 604M | **LICENSE** (repo root) | **pnpm** monorepo; `Kortix-Computer-Frontend`, `kortix-api` (`package.json` scripts) | **Low** — secrets, Stripe, multi-app dev |
| `argo-workflows` | Yes | 105M | **LICENSE** (Apache-2.0 typical) | Go controller + **React** UI (`ui/package.json`, webpack) | **Low** — K8s cluster |
| `ftqmp-scheduler` | Yes | 24M | **MIT** — README badge | Rust + Python (Qiskit); Docker `docker build` | **Medium** — Docker image for scheduler CLI/viz |
| `quota-monitoring-solution` | Yes | 5.4M | Google **LICENSE** | Java Cloud Functions + Terraform (`pom.xml`, `terraform/`) | **Low** — GCP project |
| `cstack-quota-monitoring` | Yes | 2.2M | **LICENSE** | Node.js metrics app (`Quota Monitor Application/package.json`) | **Medium** — app + Grafana template |
| `README.md` | N/A | 4K | — | Pointer doc | — |
| `clone-all.sh` | N/A | 4K | — | Bash clone helper | Run anytime |

## Not cloned (mentioned in master prompt)

| Project | Notes |
| --- | --- |
| OpenStack **Horizon** | Not under `vendor-references/`; add in Phase 2 if inventory/provider UI needs primary source |
| **quantify-scheduler** | Not cloned |
| **QCRAFT Scheduler** | Verify repo exists before clone |

## `clone-all.sh` coverage

Script clones: coldfront, ftqmp-scheduler, qbraid, xdmod, ondemand, blazar, argo-workflows, hpc-toolset-tutorial, librebooking, companyos, codeflare, **mcad**, quota-monitoring-solution, cstack-quota-monitoring.

## Reuse policy (engineering, not legal advice)

| License family | QRP approach |
| --- | --- |
| MIT / Apache-2.0 | Independent reimplementation of patterns; no verbatim UI asset copy |
| LGPL-3.0 (XDMoD) | API/reporting **patterns** only; do not link/copy PHP UI bundles |
| AGPL-3.0 (ColdFront) | **No** merge of Django app; study workflows and DRF shapes |
| GPL-3.0 (LibreBooking) | Calendar UX patterns only |

## Verification commands used

```bash
ls vendor-references/
test -d vendor-references/<name>/.git && echo cloned
du -sh vendor-references/*
# Stack: pyproject.toml, setup.py, package.json, composer.json per repo
```
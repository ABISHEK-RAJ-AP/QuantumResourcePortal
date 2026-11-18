# Open XDMoD (`vendor-references/xdmod`)

## Purpose

**HPC usage analytics**: job metrics, QoS, capacity reporting, reconciliation against scheduler logs — auditor and PI dashboards.

**Users:** Centre leadership, PIs, support staff, funding auditors.

## Verified frontend stack

| Artifact | Finding |
| --- | --- |
| Root `LICENSE` | **LGPL-3.0** |
| `docs/dev-code-organization.md` | PHP application + `etl/` Node pipeline; Apache deployment |
| UI | Server-rendered PHP + JS charting (not React); install paths `open_xdmod/` |

No root `package.json` for main portal UI in shallow clone — ETL uses Node under `etl/`.

## Key directories

- `open_xdmod/` — PHP application modules  
- `etl/` — ingestion / aggregation  
- `docs/` — install, config, SimpleSAML  
- `tests/ci/` — integration/bootstrap scripts  

## Sample URLs / routes

Deployment-specific (Apache vhost). Logical areas from docs: **summary**, **usage**, **job viewer**, **report generator** — verify in `open_xdmod` PHP routers during Phase 2 grep.

ColdFront integration: `coldfront/plugins/xdmod/` in ColdFront clone.

## Licence

**LGPL-3.0** (root `LICENSE` file header)

## Reusability for QRP

| Adopt | Avoid |
| --- | --- |
| Metric definitions (walltime, wait, CPU hours) | Embedding PHP UI |
| ETL “scheduler log → rollup” pattern | LGPL bundle linkage without legal review |
| Auditor export workflows | Copying SimpleSAML setup wholesale |

## Limitations

Heavy install (DB, ETL cron, Apache). Not practical for quick local UI capture without Docker/RPM.

## QRP modules influenced

Home, Operations Centre, Metering, Reconciliation, Audit/Evidence reporting.
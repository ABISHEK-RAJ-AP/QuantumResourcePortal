# Reference screenshot gallery (placeholder)

Phase 1 does not run every vendor stack locally. This directory will hold **browser-captured** screenshots from reference applications, organised by QRP capability.

## Naming convention

`{capability}-{reference}-{route-or-page}-{state}.png`

Examples:

- `dashboard-xdmod-portal-summary-populated.png`
- `approvals-coldfront-allocation-request-list.png`
- `jobs-ondemand-dashboard-active.png`

## Required metadata (per image)

Create a sibling `*.meta.json` or record in `IMPLEMENTATION_LOG.md`:

| Field | Example |
| --- | --- |
| `repository` | `vendor-references/coldfront` |
| `source_path` | `coldfront/core/allocation/templates/...` |
| `route` | `/allocation/request-list` |
| `qrp_module` | Approvals |
| `license_note` | AGPL — pattern only, no asset copy |
| `date_captured` | ISO date |

## Phase 2+

Run ColdFront, OnDemand, XDMoD via `hpc-toolset-tutorial` Docker where feasible (tutorial repo is **archived** — verify with upstream teams before relying on compose).
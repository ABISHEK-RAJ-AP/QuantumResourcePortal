# QRP UX audit (code-based, Sprint 0)

## Navigation consolidation (implemented)

| Old route | New destination | Redirect |
| --- | --- | --- |
| Overview | Home `/qrp` | `/qrp/overview` → `/qrp` |
| Operations Centre | Operations `/qrp/centre` | label only |
| Review Queue | Approvals `/qrp/approvals` | — |
| Backends, Pools | Resources `/qrp/inventory` | `/qrp/backends`, `/qrp/pools` |
| Connectors | Providers `/qrp/providers` | `/qrp/connectors` |
| Quota ledger | Quotas `/qrp/quotas` | — |
| Metering rollups | Metering `/qrp/metering` | old “Usage” label |
| Audit Trail, Evidence | Audit `/qrp/audit` | `/qrp/evidence` |
| Roles, Permissions, Users | Access `/qrp/admin/users` | admin redirects |

## Defects — status

| Defect | Fix layer | Status |
| --- | --- | --- |
| 5 KPI horizontal scroll | `KpiStrip` auto-fit + compact tiles | Fixed |
| Duplicate Overview/Ops nav | IA "Work" group | Fixed |
| ULID in page description | `formatPrincipalId` on Home | Fixed |
| Draggable dashboard missing | Port grid + `OverviewDashboardGrid` | Fixed |
| Users/settings loading | API mapping | Fixed (Sprint 1) |
| Quota ledger mismatch | Backend aggregation | Sprint 10 remaining |

## Routes still on legacy pages (tabs not split yet)

Inventory, Jobs, Providers, etc. retain existing screens; navigation labels updated. Full workspace tabs = Sprint 6–7.
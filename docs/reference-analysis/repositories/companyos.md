# Kortix CompanyOS (`vendor-references/companyos`)

## Purpose

**AI company / agent ops** monorepo: projects, human-in-the-loop approvals, provider budgets, audit — modern SaaS UX contrast to national-lab QRP tone.

**Users:** Power users automating business ops (not HPC PI persona).

## Verified frontend stack

| Artifact | Finding |
| --- | --- |
| Root `package.json` | **pnpm** workspace; scripts `dev:web` → `Kortix-Computer-Frontend`, `dev:api` → `kortix-api` |
| Scale | ~604M clone — many apps (`apps/mobile`, `apps/sandbox`, …) |

Exact framework for `Kortix-Computer-Frontend`: inspect `apps/` package (Phase 2) — monorepo uses modern React/TS patterns.

## Key directories

- `apps/api/` — backend API  
- Apps filtered by `package.json` workspace — primary web UI under computer frontend package  

## Sample routes

Local: `pnpm dev:web` / `pnpm dev:api` per README scripts — requires env secrets (`secrets:check` script).

## Licence

Root `LICENSE` — verify SPDX before screenshot redistribution.

## Reusability for QRP

| Adopt | Avoid |
| --- | --- |
| Approval queue clarity, audit log density ideas | SaaS marketing chrome in `/qrp/*` |
| Project-scoped secrets/routing **concepts** | Copying Stripe/billing flows |

## Limitations

Heavy monorepo; not quantum/HPC domain. Use as **secondary** reference for approvals/audit UX only.

## QRP modules influenced

Approvals, Access (scoped project permissions), Audit (presentation patterns), Settings integrations.
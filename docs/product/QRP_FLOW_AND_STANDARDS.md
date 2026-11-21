# QRP flow, logic, and UI standards

Q-TeleScope patterns for **structure and operator UX**; **QRP domain** for routes, copy, and governance flows. Visual chrome: Cert Studio on public/auth; Operate mode in `/qrp/*`. See also [DESIGN.md](./DESIGN.md), [QTELESCOPE_UI_PARITY.md](./QTELESCOPE_UI_PARITY.md).

## Public journeys

| Step | Route | Guard | Outcome |
| --- | --- | --- | --- |
| Marketing | `/` | — | Hash sections `#capabilities`, `#features`, `#workflow`, `#faq` |
| Sign in | `/login` | `PublicOnly` | Session cookie → `safeReturnPath(from)` default `/qrp` |
| Register org | `/register` | `PublicOnly` | Gated by API `organization_registration` / `self_registration`; closed → “Request access” copy |
| Forgot / reset | `/forgot-password`, `/reset-password` | Public | Admin-assisted reset; token form when API enables it |
| MFA | `/mfa` | Session partial | Shown when login returns `MFA_REQUIRED` |
| Legal | `/legal/*` | — | Same public shell as landing |

**Registration gate (one source):** `usePublicRegistration()` — header, footer, landing CTA, and auth footer links.

## Authenticated workspace

| Layer | Behaviour |
| --- | --- |
| `RequireAuth` | All `/qrp/*` — loading shell, else redirect `/login` with `state.from` |
| `ProtectedRoute` | Admin RBAC routes — `AccessDeniedPage` in-place (URL kept); unauthenticated → login |
| `permissionForRoute` | Mirrors server nav registry for admin URLs |
| Home | `/qrp` → `OverviewPage` by `detectWorkspace`: researcher · admin · provider |

Post-login **never** uses open redirects — `safeReturnPath` blocks `//` and protocol tricks.

## QRP governance flow (product logic)

```text
Project workload → staged approvals → quota authorise → dispatch attempt → reconciliation → audit
```

| Stage | Primary surfaces |
| --- | --- |
| Request | Projects, Approvals (`scope=mine` for researchers) |
| Review | Approvals, Approval history, Policies |
| Capacity | Quotas, Reservations, Scheduling |
| Execution | Jobs, Dispatch, Reconciliation |
| Evidence | Audit, Operations centre, Incidents, Support alerts |
| Tenancy | Organization, People & access, Settings |

Provider operators use **provider** nav (inventory, connectors, onboarding board). CDAC fabric copy; not multi-vendor observability.

## UI standards (Operate)

1. **Page chrome** — `title` + short `description` + `descriptionHelp` (header `InfoTip`). Prefer `opsPageGuidance.ts` keys.
2. **No essay subtitles** — long text in tooltips, panel `tip`, or record workspace `nextAction.help`.
3. **Related nav** — text links via `RelatedNav`, not duplicate button rows.
4. **Permissions** — hide nav items without `perm`; server remains authoritative.
5. **Unknown data** — em dash, not invented metrics.
6. **Copy** — sentence case; QRP vocabulary (organization, workload, quota, dispatch). No Q-TeleScope product naming on user-facing strings.

## Workspace map (admin default)

Groups: Home → Review → Allocate → Dispatch → Resources → Operations → Governance → Administration. Researcher and provider navs are subsets defined in `navigation.ts`.

## Verification

- Unit: `npm run test` (incl. `safeReturnPath`, `hashNav`).
- Build: `npm run typecheck && npm run build`.
- E2E smoke: `npm run test:e2e:smoke` with API + DB (public hash nav, auth, core `/qrp` routes).

## When adding a feature

1. Pick route under `/qrp/...` and permission from backend registry.
2. Add or reuse `opsPageGuidance` entry before writing body copy.
3. Wire `Page` / `RecordWorkspace` with Operate patterns.
4. Public surfaces: `PublicShell` or auth primitives only; QRP strings in `copy/` or page-local FAQ.
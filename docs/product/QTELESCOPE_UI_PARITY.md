# Q-TeleScope UI parity (structure) · Cert Studio theme (chrome)

QRP reuses **layout, flow, and alignment** from mature Q-TeleScope (`Quantum_Monitoring-main`). **Copy, routes, and domain** stay QRP (governance, approvals, quotas, fleet inventory, dispatch). **Visual skin** stays Cert Studio (intro scene, outline fields, operator tokens)—not TeleScope observability branding.

## Reference vs target

| Layer | Read (reference) | Implement (QRP) |
| --- | --- | --- |
| Public header/footer | `frontend/src/components/marketing/PublicMarketingHeader.jsx`, `PublicMarketingFooter.jsx` | `PublicHeader.tsx`, `PublicFooter.tsx` + `public-layout.css` |
| Auth login | `AuthShell.jsx` `layout="cert"` | `AuthPanel.tsx` (centred cert card + `PublicShell`) |
| Auth register | `AuthShell.jsx` `layout="register-studio"` + `register-cert.css` | `AuthRegisterWideShell.tsx` → `auth-shell--register-studio` / `reg-cert-panel` |
| Landing sections | `LandingPage.jsx` hash nav + section rhythm | `LandingPage.tsx` + `qre-public-landing-polish.css` |
| Workspace shell | `App.jsx` sidebar + top bar (`index.css`) | `chrome.tsx` + `craft-ops.css` (same IA pattern; QRP nav labels) |

## Intentional QRP deltas

- **A11y preheader** (`A11yPreheader`) — public/workspace bars sit `sticky top-8`; TeleScope uses `top-0` only because it has no preheader. Do not remove preheader for parity.
- **Background** — Cert Studio `IntroSceneBackground` + wire backdrop on auth/landing; TeleScope uses `QuantumBackground` on auth.
- **Brand** — `LogoMark` + “Quantum Resource Portal” / C-DAC governance; never Q-TeleScope product strings on public surfaces.

## Content guardrails (grep before release)

- No “Q-TeleScope”, “observability fleet”, or TeleScope module names in user-facing QRP copy.
- Hash anchors on landing: `#capabilities`, `#features`, `#workflow`, `#faq` (same as TeleScope; section **content** is QRP).

## Parity checklist

### Public

- [x] Header: brand left · section nav centre · theme + sign-in + register right (`public-layout.css`).
- [x] Register CTA gated by `usePublicRegistration()` (auth capabilities), matching TeleScope.
- [x] Nav visible from `md` (768px), hamburger below that (TeleScope pattern).
- [x] Footer: brand column + link grid + bottom bar (TeleScope layout).
- [x] Landing section headers aligned (`landing-section__header`).
- [x] SPA hash navigation without full reload (`hashNav.ts`); footer hash links use same helper.
- [x] Legal + route error pages use `PublicShell` + `landing-page` + Cert Studio styles.

### Auth

- [x] Login: full public shell, centred cert card, outline fields scoped to `.qrp-auth-shell`.
- [x] Register: `register-studio` panel (`reg-auth-main` / `reg-cert-panel`) with Cert Studio register CSS.
- [x] Forgot / reset / MFA: `AuthPanel` cert card + `showBackLink` + footer links (same as login).
- [x] Auth routes: compact public footer (copyright bar), not full marketing grid.

### Workspace (`/qrp/*`)

- [x] Left nav groups, collapse, page chrome (`Page` + `descriptionHelp`).
- [x] Sidebar width 260px / collapsed 64px (TeleScope `index.css` parity).
- [x] Operate copy via `opsPageGuidance.ts` (QRP domain, not observability essays).

### Verification

- [x] `npm run typecheck`, `npm run build`, `npm run test` (incl. `hashNav.test.ts`)
- [x] Playwright: `e2e/public-marketing.spec.ts` (landing hash + auth footer hash)
- [ ] `npm run test:e2e:smoke` full stack when API + DB up

## When adding a new public or auth screen

1. Wrap in `PublicShell` (or workspace `AppShell` if authenticated).
2. Prefer existing auth primitives: `AuthPanel`, `AuthOutlineField`, `AuthRegisterWideShell`.
3. Pull structure from TeleScope; swap strings to QRP `AUTH_COPY` / `opsPageGuidance`.
4. Theme: Cert Studio CSS under `frontend/src/styles/cert-studio/`—do not copy TeleScope cyan hero into `/qrp/*`.
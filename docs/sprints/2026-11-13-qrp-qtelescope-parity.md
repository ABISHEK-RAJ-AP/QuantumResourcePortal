# QRP operator UI parity with Q-TeleScope

Date: 2026-11-13. Sequential slices. One commit each. QRP theme stays. Q-TeleScope is the operator-bar reference, not a second design system.

Worktree: `/home/boss/Desktop/qrp-afk-2026-11-13` on branch `afk/2026-11-13` from `main` at `266869b`. The original checkout at `quantum-resource-portal/` has uncommitted work (106 paths). That tree was not edited.

## Phase 0 — Discovery (done)

QRP product app is the React frontend in this repo (`frontend/`, Vite, React 19, TypeScript, Tailwind 4, shadcn `components.json`). Desktop launcher `Start-QRP.sh` points at this app (UI `:5176`). No second QRP web app turned up under `/home/boss/Desktop`, `/home/boss`, or `/home/boss/Projects`.

Q-TeleScope reference (read only): `/home/boss/Desktop/Quantum_Monitoring-main`. Git history is present (`be80655` ops shell, `b7436ef` one-line filter labels, `08d1c62` command palette).

### Patterns to port (concrete)

| Pattern | Who it helps | Q-TeleScope evidence | QRP today |
| --- | --- | --- | --- |
| One-line inline search with the label on the field border | Operator scanning a long list | `frontend/src/components/ds/FilterBar.jsx` (`outline-field`), `frontend/src/index.css` around the `label.outline-field` rules, `frontend/src/styles/app-shell-density.css` (`.page-toolbar-unified`) | `frontend/src/components/data/FilterBar.tsx` is a wrapping chip row plus a plain `field-input` |
| Command palette (Ctrl/Cmd+K), route commands, empty and searching states | Operator jumping between console pages | `frontend/src/components/shell/CommandPalette.jsx`, wired from `frontend/src/App.jsx` | No palette. Workspace header is `frontend/src/components/layout/chrome.tsx` |
| Light/dark from one token set, class `dark` on `<html>` | Operator on a projector and at night | `frontend/src/components/ui/ThemeProvider.jsx`, `docs/product/DESIGN.md` | `frontend/src/components/theme/ThemeProvider.tsx` toggles `.dark`. Tokens live in `frontend/src/styles/index.css` (`:root` and `.dark`). Landing still hardcodes `#0b1220` and `text-white/70` in `frontend/src/pages/public/LandingPage.tsx` |
| Shared states: empty, error with retry, skeleton | Operator who hits a failed query | `frontend/src/components/observability/EmptyState.jsx`, `ErrorState.jsx` | `EmptyState`, `LoadingLine`, `Notice` in `frontend/src/components/layout/Page.tsx`. `QueryBody` in `frontend/src/pages/workspace/screens.tsx` shows `Notice` and does not offer retry |
| Dense ops chrome: page toolbar, relative freshness, theme control | Fleet operator on one screen | `frontend/src/App.jsx` header (`PageHeader`, `IstClock`, theme button), `frontend/src/styles/app-shell-density.css` | `chrome.tsx` has breadcrumbs, `DataFreshness`, density prefs, theme toggle, and a full `window.location.reload()` |
| Chart theme follows light/dark | Analyst reading a chart | `frontend/src/components/observability/chartTheme.js` | QRP charts use `--chart-1` … `--chart-5` in `index.css`. Not audited page by page in this phase |

Antislop mode in `~/.config/antislop/settings.json` is `during`. UI edits are allowed in later phases and must follow that mode. This phase did not edit UI.

Impeccable `context` ran in this worktree. It found no `PRODUCT.md` and no `DESIGN.md`. Visual authority used instead: `frontend/src/styles/index.css` and `docs/00_REQUIREMENTS_AND_DESIGN.md`. Operate-mode app UI. QRP tokens win over the GridPulse demo spectrum. `/impeccable init` was not run.

## Phase 1 — Design-system prerequisites (done, no code)

Already on `266869b`. Nothing to install.

| Need | Where it already is |
| --- | --- |
| TypeScript | `frontend/tsconfig.app.json` (`strict`, `paths`: `@/*` → `./src/*`). Script `npm run typecheck` (`tsc -b`) |
| Tailwind | Tailwind 4 via `@tailwindcss/vite`. Entry `@import 'tailwindcss'` in `frontend/src/styles/index.css`. `components.json` `tailwind.css` is `src/styles/index.css` |
| `cn` | `frontend/src/lib/utils.ts` uses `clsx` and `tailwind-merge`. Both are dependencies |
| shadcn aliases | `frontend/components.json`: `ui` = `@/components/ui`, `utils` = `@/lib/utils` |
| UI components | `frontend/src/components/ui/` (cube wave, hover grid, cyber matrix, modal, info tip) |

### Why `/components/ui` matters, and why this repo does not add it

The shadcn CLI default component root is `/components/ui` at the project root, next to a default `@/components/ui` alias. QRP’s real alias is `frontend/src/components/ui` (`@/components/ui`). A second root at `/components/ui` would split imports and make the CLI write files the app does not compile. Later slices stay on `@/components/ui`. Do not run `npx shadcn init`. The toolchain is already Tailwind 4 + TypeScript.

## Phase 2 — GridPulse in QRP contrast (done, not mounted)

File: `frontend/src/components/ui/grid-pulse.tsx`. Not imported. No `demo.tsx`. No new dependency.

Ink: each lit cell lerps computed `--primary` to `--brand-cyan` by row (indigo at the top, cyan at the bottom). A theme class change re-reads those variables. If the variable is missing, fallbacks are the hex values in `frontend/src/styles/index.css` (`#536dfe` / `#20b8d5` on a light page, `#7b8cff` / `#3ad0ea` on a dark page). The page is classified from the inherited text colour. A short shade ladder darkens the light-theme band so `#20b8d5` stays visible on `#ffffff`, and barely darkens the dark-theme band so `#7b8cff` and `#3ad0ea` stay visible on `#0b1220`. Cells behind `[data-grid-avoid]` still drop to the faint alpha. Hairlines still use `--grid-pulse-line` from `--color-foreground`.

Reduced motion returns before the canvas loop. The node is `aria-hidden` and `pointer-events-none`. The draw loop stops when no cell is lit. An `IntersectionObserver` pauses the ambient beat off screen.

`npm run typecheck` (`tsc -b`) exits 1 on a pre-existing parse error in `frontend/src/pages/public/ForgotPasswordPage.tsx` (`function motionless-brand` at line 42). That file was not edited. `grid-pulse.tsx` is not in the error list. The worktree has no `node_modules`; the check used the sibling install and did not change it.

### Recommended mount (not done)

Do not mount on current surfaces.

- `frontend/src/pages/public/LandingPage.tsx` is a positioned hero and already runs `CubeWaveHero`.
- Auth pages (`LoginPage.tsx`, `RegisterPage.tsx`, `ForgotPasswordPage.tsx`, `ResetPasswordPage.tsx`) already run `CyberMatrixHero`.
- `frontend/src/components/layout/chrome.tsx` is a sticky header plus page outlet, not a full-bleed backdrop.

Mount later on the first operator region that is `relative` and does not already own a canvas. Put `GridPulse` under the content. Add `data-grid-avoid` only on real text in that region. Do not restyle the app to create that region.

## Later phases

Phase 3 is the only next slice. Do not start it in the GridPulse commit.

Each item names who it helps, the file evidence, size, and risk. Fifteen ideas are in `.afk/2026-11-13.md`. These are the ordered slices.

### Phase 3 — One-line workspace search

- **Who:** approver scanning approvals and inventory.
- **Evidence:** QRP `frontend/src/components/data/FilterBar.tsx` wraps chips and a plain input. Q-TeleScope `frontend/src/components/ds/FilterBar.jsx` plus `label.outline-field` in `frontend/src/index.css`.
- **Size:** small. Restyle `FilterBar` only. Callers stay on the same props.
- **Risk:** low. Placeholder and `aria-label` must stay. Do not invent result counts.

### Phase 4 — Command palette

- **Who:** operator moving across Govern routes without the sidebar.
- **Evidence:** missing under `frontend/src`. Q-TeleScope `CommandPalette.jsx` and `useCommandPaletteShortcut` in `App.jsx`. QRP nav is server-shaped in `chrome.tsx`.
- **Size:** medium. New component plus a shortcut in the shell. Commands must come from the same nav the server already returns.
- **Risk:** medium. **Changes behavior** (new keyboard route). Wrong commands would expose pages the role cannot open. Empty query and no-match states are required (antislop).

### Phase 5 — Theme contrast on public and shell chrome

- **Who:** operator and reviewer in light and dark, including a bright room.
- **Evidence:** tokens in `frontend/src/styles/index.css`. Hardcoded `#0b1220`, `text-white/70`, `text-cyan-300` in `LandingPage.tsx`. Eyebrow `text-[11px]` in `chrome.tsx`.
- **Size:** small, those files only.
- **Risk:** low visual, check AA on cyan-on-navy and 11px uppercase.

### Phase 6 — Query errors can retry

- **Who:** operator whose summary request failed.
- **Evidence:** `QueryBody` in `frontend/src/pages/workspace/screens.tsx` renders `Notice` with no action. Q-TeleScope `ErrorState.jsx` has `onRetry`.
- **Size:** small, `QueryBody` and `Notice` or `Page.tsx`.
- **Risk:** medium. **Changes behavior** (a failed panel can refetch). Retry must call the query’s refetch, not reload the browser.

### Phase 7 — Empty copy says what is actually empty

- **Who:** operator who must not treat a quiet fleet as fake telemetry.
- **Evidence:** strings in `frontend/src/pages/workspace/continue.tsx` and `screens.tsx` such as “Empty sample.”, “Fleet quiet.”, “Empty provider sample.”
- **Size:** small copy pass on those call sites. Keep `EmptyState` in `Page.tsx`.
- **Risk:** low. **Changes behavior** of what the operator believes is missing. No invented metrics.

### Phase 8 — Motion and focus on decorative grids

- **Who:** operator who set reduced motion, and keyboard users.
- **Evidence:** `HoverGrid` in `frontend/src/components/ui/hover-grid.tsx` always listens to `mousemove` and sets `pointer-events-auto`. Shell focus ring exists at `index.css` `:focus-visible`. `A11yPreheader.tsx` already reads `prefers-reduced-motion`.
- **Size:** small, `hover-grid.tsx` plus a check that icon buttons in `chrome.tsx` keep a visible focus ring.
- **Risk:** low.

### Phase 9 — Workspace toolbar density

- **Who:** operator fitting filters and freshness on one row.
- **Evidence:** QRP density hooks in `index.css` (`.shell-canvas[data-density]`) and header wrap in `chrome.tsx`. Q-TeleScope `.page-toolbar-unified` in `app-shell-density.css`.
- **Size:** medium. One toolbar row. Do not restyle every page.
- **Risk:** medium layout. Tables in `screens.tsx` must not lose their filter.

### Phase 10 — Refresh without a full reload

- **Who:** operator who refreshed and lost in-page scroll and form state.
- **Evidence:** `chrome.tsx` refresh button calls `window.location.reload()`.
- **Size:** small if it only invalidates TanStack queries already on the page.
- **Risk:** medium. **Changes behavior.** A reload today resets the SPA; query invalidation must not pretend data reloaded when a query is not mounted.

### Phase 11 — Relative time on freshness

- **Who:** operator comparing “updated just now” with Q-TeleScope’s clock.
- **Evidence:** `DataFreshness` used in `chrome.tsx`. Q-TeleScope `IstClock.jsx` and commit `2ec79c9`.
- **Size:** small, the freshness component only. Read it before editing. Do not add a second clock.
- **Risk:** low.

### Phase 12 — Chart series follow the active theme

- **Who:** analyst on the governance overview charts.
- **Evidence:** `CHART_COLORS` in `screens.tsx`. Tokens `--chart-*` are identical in `:root` and `.dark` inside `index.css` (dark block does not override them).
- **Size:** small token override in `.dark`.
- **Risk:** low. Do not invent series.

## Untangle (gated)

Waiting on the user: Comments, Tests, or neither. Do not delete comments or tests until they choose.

Structural notes only (no refactor this sprint until that choice):

- **Surplus:** `frontend/src/pages/workspace/continue.tsx` and `screens.tsx` hold most workspace screens, empty branches, and chart setup in two files.
- **Surplus decoration:** landing hero runs `CubeWaveHero` plus a gradient veil (`LandingPage.tsx`); feature cards also mount `HoverGrid`.
- **Special cases:** `QueryBody` vs direct `EmptyState` vs `Notice` for the same failure idea.
- **Hidden control:** header refresh looks like a data refresh and reloads the document (`chrome.tsx`).

## Non-goals

- No Unsplash or other stock photos. GridPulse has no images. Do not add any.
- No new `lucide-react` usage for GridPulse. Do not add the dependency (it is already installed for the rest of the app).
- No new marketing page.
- No push, no pull request, no deploy.
- No second component root.
- No edit to the dirty `main` checkout.
- Q-TeleScope files stay read-only.

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

## Phase 2 — GridPulse in QRP contrast (next, not started)

Do this phase alone. Antislop mode is `during`, so UI edit is allowed. React and TSX are in place.

Source the user supplied (do not use the demo as product UI):

- Copy `grid-pulse.tsx` to `frontend/src/components/ui/grid-pulse.tsx`.
- Import `cn` from `@/lib/utils`. Drop `"use client"` (Vite SPA, not Next).
- Keep reduced motion early return, `aria-hidden`, `pointer-events-none`, canvas sleep when nothing is lit, text-avoid (`avoid` default `[data-grid-avoid]`), fade, and max-lit cap.
- Replace `HUE_TOP` / `HUE_SPAN` rainbow (`hsl` sweep 60→270) with QRP theme ink:
  - Light (`:root`): cells use `--primary` `#536dfe` and `--brand-cyan` `#20b8d5` at lightnesses that stay visible on `--background` `#ffffff` and do not wash `--foreground` `#172033`.
  - Dark (`.dark`): cells use `--primary` `#7b8cff` and `--brand-cyan` `#3ad0ea` visible on `--background` `#0b1220` without washing `--foreground` `#e8eef9`.
  - Hairline stays `--grid-pulse-line` mixed from `--color-foreground` (already in the component). Lit cells must not use the demo’s pale ladder (`TINTS` 88–56) on white, or the deep ladder on near-black if the result falls under the text colour.
- Do not add `demo.tsx`. No “grid pulse” headline, no text toggle, no Unsplash, no new lucide icons (the component has none). `lucide-react` is already a dependency; do not add icons for this slice.
- Mount: operator shell `chrome.tsx` has no full-bleed positioned hero. `LandingPage.tsx` and auth pages already run `CubeWaveHero` or `CyberMatrixHero`. Stacking a second canvas restyles those surfaces and costs a second animation loop. **Add the component file only.** Recommended later mount, after a surface exists that is positioned and does not already own a canvas: under that surface’s content, `data-grid-avoid` only on real text. Do not restyle the app. Do not put GridPulse on the marketing hero in this slice.
- Verify with `npm run typecheck` in `frontend/`. Do not start a second dev server if `:5176` is already up. Browser-check only if you mount; a file-only slice has nothing to click.

## Later phases (one each, after Phase 2)

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

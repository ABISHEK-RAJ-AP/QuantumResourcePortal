# QRP operator UI — design direction

Visual direction for `/qrp/*` workspace routes. Operate mode: scan, decide, act.

**Public/auth shell:** Same **layout and flow** as Q-TeleScope (header, footer, login, register, landing sections); **Cert Studio** theme on marketing/auth; **QRP** copy and routes only. See [QTELESCOPE_UI_PARITY.md](./QTELESCOPE_UI_PARITY.md).

**Flows and standards:** Auth guards, governance pipeline, nav by workspace, and Operate rules — [QRP_FLOW_AND_STANDARDS.md](./QRP_FLOW_AND_STANDARDS.md).

## Intent

- **Audience:** lab admins, project leads, provider operators (CDAC demo).
- **Tone:** calm control room — dense but readable, no marketing hype.
- **Job:** register fleet → approve workloads → dispatch → reconcile exceptions.

## Layout

- **Shell:** left nav, page title with optional InfoTip (not subtitle essays), toolbar actions in header.
- **Grids:** `auto-fill` minmax; equal-height metric tiles where used.
- **Related navigation:** `RelatedNav` text links, not duplicate button rows.

## Typography & density

- Page title in shell header; subtitle max two lines (`type-desc-clamp`).
- Long guidance lives in header InfoTip or KPI `labelTip`, not body copy cards.
- KPI values use `tabular-nums`.

## Color & state

- Existing CSS tokens (`--primary`, semantic success/warning/critical).
- No purple/cyan gradient hero treatment on workspace pages.
- Unknown values show em dash, not invented metrics.

## Motion

- `prefers-reduced-motion` respected (`motion-ops.css`).
- No decorative pulse loops on status dots.

## Content rules

- Sentence case labels (no ALL CAPS kicker in header; field labels use `text-[11px] font-medium`, not tracked uppercase).
- Progressive disclosure: filters in toolbar; detail in tooltips.
- Page copy: short `description` on `Page`; long text in `descriptionHelp` (header `?`). Prefer `opsPageGuidance.ts` over inline essays.
- Section copy: `PanelHeader` `tip` and `ChartPanel` `tip`; drop redundant paragraphs under the title.
- Record detail: `RecordWorkspace` `nextAction.body` = one line; `nextAction.help` = sidebar `?`.

## Acceptance

1. No duplicate freshness banners in body when header shows `DataFreshness`.
2. Summary-only routes (Procurement) — no fake forms or essay cards.
3. `npm run typecheck` and `npm run build` pass after UI edits.
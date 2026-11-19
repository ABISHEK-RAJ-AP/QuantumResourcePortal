# Unslop audit — Quantum Resource Portal

**Skill:** `tools/unslop/skills/unslop` ([heydamir/unslop](https://github.com/heydamir/unslop))  
**Mode:** Polish (post–StyleMole pass; heavy card/grid slop already reduced)  
**Scope:** Public marketing (`/`, chrome) — 2026-11-19

## Direction

| Line | QRP |
| --- | --- |
| **Product** | Institution governance console for quantum workloads: approvals, quotas, dispatch, audit. |
| **Character** | Exact, calm, institution-scale (not startup hype). |
| **World** | Control rooms, ledgers, policy trails — graphite + one cyan instrument accent. |
| **Moments** | Lead capability tile on landing; live workspace tables after sign-in. |
| **Signature** | Stage-gated G1–G3 language and real module map (no fake dashboard mock). |

## Signs found (public)

| Sign | Location | Fix |
| --- | --- | --- |
| Uppercase tracked section kickers (`Console`, `Modules`) | `public-landing.css` `.qrp-landing-kicker` | Sentence case, normal tracking (unslop type) |
| Marketing metadata in hero eyebrow | `LandingPage.tsx` | Moved to footer bar (hero stays product-only) |
| Ambient grid motion | `GridPulse` on landing | Already reduced; hidden under `prefers-reduced-motion` |
| Radial wash on public shell | `craft-ops.css` `.qrp-public-shell` | Kept — neutral OKLCH, not purple SaaS blob |
| Shouty dual CTAs in hero | Landing | One primary + one secondary link (unchanged, acceptable) |

## Workspace (deferred)

- Widespread `uppercase` + `tracking-[0.12em]` on `<dt>` labels in `screens.tsx` / `continue.tsx` matches TeleScope **ops meta** pattern; batch migrate to sentence case only if DESIGN.md adopts unslop label rules globally.

## Passes applied this run

1. **Type** — hero/section titles 600 (not 800); shorter hero min-height.  
2. **Layout** — lead capability + 2-up row; module grid 2-col from `lg` only; workflow without numbered pills.  
3. **Eyebrow budget** — section kickers removed (hero eyebrow only).  
4. **Auth** — aside copy without lab-demo trail.  
5. **A11y** — KPI autoplay page announce (`aria-live` polite).  
6. **Legal** — left-aligned reading column (`qrp-landing-main`).

## Re-run

```
unslop the landing page
unslop https://127.0.0.1:5176/login
```

Follow `.cursor/skills/unslop/SKILL.md`.
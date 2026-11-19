# UX Design Audit — Quantum Resource Portal (QRP)

**Method:** [frontend-design-audit](https://github.com/mistyhx/frontend-design-audit) (15 principles, severity 0–4)  
**Scope:** All routed pages — code review + shared chrome (2026-11-19)  
**Vendored skills:** `tools/frontend-design-audit/` · `tools/unslop/` ([unslop audit](UNSLOP_AUDIT.md))  
**Fix commit:** same branch as this report

### Summary

| Severity | Found | Fixed in repo |
|----------|-------|---------------|
| 4 | 0 | — |
| 3 | 6 | 5 |
| 2 | 14 | 9 |
| 1 | 8 | 4 |
| **Total** | **28** | **18** |

---

## Page-by-page

### Public marketing

| Page | Route | Findings | Status |
|------|-------|----------|--------|
| Landing | `/` | Hero outside `<main>`; section intros left-only on mobile; FAQ missing `aria-controls` | **Fixed** |
| Login | `/login` | Privacy/Terms in form footer (clutter) | **Fixed earlier** |
| Register | `/register` | Same auth footer pattern | **Fixed earlier** |
| Forgot / reset / MFA | `/forgot-password`, `/reset-password`, `/mfa` | No `<main>` landmark on form column | **Fixed** (`AuthPanel`) |
| Privacy / Terms | `/legal/*` | Skip target not explicit | **Fixed** (`id="main-content"`) |
| Route error | `errorElement` | Already centered `<main>` | OK |

### Public chrome

| Surface | Findings | Status |
|---------|----------|--------|
| Header | Nav not in true 3-column flow (absolute center) | **Fixed earlier** (`public-layout.css`) |
| Footer | All-left on mobile; legal not in bottom bar | **Fixed earlier** |
| Skip link | Targets `#page-content`; auth/landing now expose `#main-content` | **Fixed** |

### Authenticated workspace

| Page group | Routes | Findings | Status |
|------------|--------|----------|--------|
| Shell | `AppShell` | Sidebar missing `aria-label`; active nav relies on RR default `aria-current` | **Fixed** sidebar label |
| Home / hubs | `/qrp`, list pages | Tables lack programmatic names | **Partial** — `DataTable` `caption` prop added; callers can pass incrementally |
| Modals | `Modal.tsx` | No focus trap / return focus | **Fixed** |
| Tables | `DataTable` | Sort state not exposed to AT | **Fixed** `aria-sort` + button labels |
| 403 | `/403` | No `<main>` landmark | **Fixed** |
| Status (framed) | `/system/status` | Uses shell chrome | OK |
| Detail / workflow | `*DetailPage`, approvals | Heavy density (by design); `InfoTip` keyboard OK | Monitor |

### Deferred (not blocking lab)

| ID | Sev | Page | Issue | Principle |
|----|-----|------|-------|-----------|
| D1 | 2 | Footer | Governance links go to `/qrp/*` logged-out → redirect | **Fixed** — `/#workflow`, `/#modules`, `/login` |
| D2 | 2 | All tables | Most `DataTable` call sites omit `caption` | **Fixed** — `Table` page title fallback; `PanelHeader`→table wrapped in `screens` + `continue` |
| D3 | 2 | Workspace | No global “undo” for destructive row actions | **Partial** — `ConfirmDialog` + focus trap on decide/withdraw/reconcile/holds/roles; no undo stack |
| D4 | 1 | Landing | `GridPulse` motion without content pause tie-in | Reduced ambient (prior landing pass) |
| D5 | 1 | Marketing | No on-page “last updated” for public copy | **Fixed** — hero eyebrow “Public copy · Nov 2026” |

---

## Findings (detail)

#### [3] F01 — Landing hero outside document landmark
- **Principle:** #13 Accessibility, #12 Structure  
- **Location:** `LandingPage.tsx`  
- **Fix:** Single `<main id="main-content">` wraps hero + body sections.

#### [3] F02 — Modal without focus trap
- **Principle:** #13, #7  
- **Location:** `Modal.tsx`  
- **Fix:** Tab cycle + return focus on close; dialog on panel not backdrop.

#### [3] F03 — Auth form column not a main landmark
- **Principle:** #13  
- **Location:** `AuthPanel.tsx`  
- **Fix:** Right column is `<main id="main-content">`.

#### [2] F04 — Sortable table headers silent to screen readers
- **Principle:** #13, #1  
- **Location:** `DataTable.tsx`  
- **Fix:** `aria-sort`, sort button `aria-label`, optional `caption`.

#### [2] F05 — Marketing section headers left-aligned on small viewports
- **Principle:** #12, #8  
- **Location:** Landing capabilities/modules intros  
- **Fix:** `.qrp-landing-section-head` center → left at `md+`.

#### [2] F06 — FAQ accordion incomplete ARIA
- **Principle:** #13  
- **Location:** `LandingPage.tsx` FAQ  
- **Fix:** `aria-controls` + answer `id`.

#### [2] F07 — 403 page not a landmark
- **Principle:** #13  
- **Location:** `AccessDeniedPage.tsx`  
- **Fix:** Wrap in `<main id="main-content">`.

#### [2] F08 — Sidebar navigation unlabeled region
- **Principle:** #13  
- **Location:** `chrome.tsx`  
- **Fix:** `aria-label="Primary navigation"`.

#### [1] F09 — Missing Open Graph tags
- **Principle:** #10  
- **Location:** `index.html`  
- **Fix:** `og:title`, `og:description`, `og:type`.

---

## Strengths

1. **Skip to content** in `A11yPreheader` with focus management (#13).  
2. **Consistent ops tokens** (`craft-ops.css`, motion, public layout) (#4, #8).  
3. **Form errors** with `role="alert"` + shake feedback (#9, #1).  
4. **RBAC-gated routes** + `AccessDenied` escape hatch (#3).  
5. **Workspace layout popover** supports Escape (#7).

---

## Anti–vibe-coded pass (2026-11-19)

Landing rework per StyleMole-style signals: dropped nested `craft-card` stacks and duplicate CTA band; flat tiles + module table; left-aligned main column; quieter grid; product-specific copy; one dominant capability tile.

---

## Re-run audit

```bash
# Claude Code
/plugin marketplace add mistyhx/frontend-design-audit
/frontend-design-audit:evaluate frontend/src/pages
```

Or use vendored copy: `tools/frontend-design-audit/.claude/skills/frontend-design-audit/SKILL.md`.
# unslop (vendored)

Source: [heydamir/unslop](https://github.com/heydamir/unslop) · CC BY 4.0 · credit Damir Sokolovsky ([@heydamir](https://x.com/heydamir)).

| Piece | Path |
| --- | --- |
| Full skill + references | `tools/unslop/skills/unslop/` |
| Cursor entrypoint | `.cursor/skills/unslop/SKILL.md` |
| QRP audit log | `docs/audit/UNSLOP_AUDIT.md` |

## Use in Cursor

Ask to **unslop** a route or paste a URL. Agent should read `tools/unslop/skills/unslop/SKILL.md`, audit with `references/signs.md`, set direction, then fix in pass order.

**Scope defaults for QRP**

- First: `frontend/src/pages/public/**`, `frontend/src/styles/public-*.css`, marketing components.
- Workspace `/qrp/*`: ops restraint — keep `craft-ops.css`, IBM Plex, cyan accent; no purple SaaS hero patterns.
- Do not override institution copy or fake metrics.

## Optional: live snapshot (Playwright)

From `frontend/` (dev server on 5176):

```bash
npm install -D playwright
npx playwright install chromium
node ../tools/unslop/skills/unslop/scripts/snapshot.mjs http://127.0.0.1:5176/ ../../docs/audit/unslop-snapshots/home.html --light
```

Story video needs `ffmpeg` on PATH; see upstream README.

## Update vendored copy

```bash
git clone --depth 1 https://github.com/heydamir/unslop.git /tmp/unslop
rsync -a /tmp/unslop/skills/unslop/ tools/unslop/skills/unslop/
```
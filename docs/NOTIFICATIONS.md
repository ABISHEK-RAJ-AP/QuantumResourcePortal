# QRP notifications (session inbox)

**Scope:** QRP frontend (`frontend/`). Backend delivery (webhook/email) remains config-driven on the governance API; this UI is an **operator inbox**, not a full notification platform.

## Behaviour

| Layer | Path | Role |
| --- | --- | --- |
| Persisted notices | `frontend/src/lib/governNotices.ts` | `localStorage` (`qrp_govern_notices_v1`), same pattern as Q-TeleScope `operatorNotices.js` |
| Toasts | `frontend/src/lib/toast.ts` | `toast(message, tone, meta?)` → persist + live card |
| Server sync | `frontend/src/lib/governServerFeed.ts` | `GET /governance/summary`, `GET /approvals?state=…` |
| Bell + panel | `frontend/src/components/notifications/*` | Header bell, modal list, 45s poll + `qrp:data-refresh` |
| Styles | `frontend/src/styles/qre-notify.css` | Imported from `index.css` |

## Permissions (QRP RBAC)

- Sync requires `approval:read`
- Per-workload approval rows require `approval:decide`

## VM update

```bash
export PATH="$HOME/miniforge3/bin:$PATH"
cd ~/QuantumResourcePortal   # git@github.com:ABISHEK-RAJ-AP/QuantumResourcePortal.git

# sync main (use if you were on afk/* or pull failed with "divergent branches")
bash scripts/vm-pull-main.sh

# install + migrate + start API + UI (background)
bash scripts/vm-setup.sh

# or interactive launcher (separate terminals :8010 / :5176)
bash scripts/start-qrp.sh
```

## Verify in UI

1. Sign in → top bar **bell**
2. Pending queue → **Review queue** notice (server)
3. Save/submit on a workflow page → call `toast('…')` → card + inbox row
4. `/qrp/notifications` → **Open notification panel**
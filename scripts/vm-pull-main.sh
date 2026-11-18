#!/usr/bin/env bash
# VM: fetch GitHub main and match it exactly (safe when local main diverged or you're on a feature branch).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

export PATH="${HOME}/miniforge3/bin:${HOME}/.local/bin:/usr/local/bin:${PATH:-}"

log() { printf '\033[1;36m[qrp-pull]\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m[qrp-pull]\033[0m %s\n' "$*" >&2; exit 1; }

command -v git >/dev/null || die "git not found — install or add miniforge to PATH"

PREV="$(git branch --show-current 2>/dev/null || echo detached)"
log "Current branch: ${PREV:-unknown}"
git fetch origin
git checkout main 2>/dev/null || git checkout -b main origin/main
git reset --hard origin/main
log "Now on main @ $(git rev-parse --short HEAD) — $(git log -1 --format=%s)"
M0010="$ROOT/backend/migrations/versions/20261118_0010_providers_backends.py"
if grep -q 'pending_jobs":' "$M0010" 2>/dev/null; then
  die "Stale migration 0010 on disk — expected op.create_table; run: git fetch origin && git reset --hard origin/main"
fi
if ! grep -q 'op.create_table' "$M0010" 2>/dev/null; then
  die "Migration 0010 missing op.create_table — git reset --hard origin/main"
fi
log "Migration 0010 fingerprint OK"
log "To return to your branch: git checkout ${PREV}"
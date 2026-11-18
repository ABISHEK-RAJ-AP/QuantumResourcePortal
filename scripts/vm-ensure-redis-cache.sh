#!/usr/bin/env bash
# Ensure Redis/Valkey for QRP cache + CAPTCHA (backend/.env: QRE_REDIS_URL, QRE_CACHE_ENABLED).
# Sessions stay in PostgreSQL; Redis is for ephemeral keys (TeleScope-style bootstrap).
set -euo pipefail

ensure_qre_redis_cache() {
  local ROOT="${1:?repo root}"
  local envf="${ROOT}/backend/.env"
  local REDIS_DIR="${REDIS_DIR:-$ROOT/.redis-data}"
  local port="${REDIS_PORT:-6379}"
  local url="redis://127.0.0.1:${port}/0"

  upsert_env() {
    local key="$1" val="$2"
    touch "$envf"
    if grep -qE "^${key}=" "$envf" 2>/dev/null; then
      sed -i "s|^${key}=.*|${key}=${val}|" "$envf"
    else
      printf '%s=%s\n' "$key" "$val" >>"$envf"
    fi
  }

  ping_redis() {
    if command -v redis-cli >/dev/null 2>&1; then
      redis-cli -p "$port" ping >/dev/null 2>&1 && return 0
    fi
    if command -v valkey-cli >/dev/null 2>&1; then
      valkey-cli -p "$port" ping >/dev/null 2>&1 && return 0
    fi
    return 1
  }

  start_user_redis() {
    mkdir -p "$REDIS_DIR"
    if command -v redis-server >/dev/null 2>&1; then
      redis-server --daemonize yes --port "$port" --dir "$REDIS_DIR" --logfile "$REDIS_DIR/redis.log" 2>/dev/null || true
      sleep 1
      ping_redis && return 0
    fi
    if command -v valkey-server >/dev/null 2>&1; then
      valkey-server --daemonize yes --port "$port" --dir "$REDIS_DIR" --logfile "$REDIS_DIR/valkey.log" 2>/dev/null || true
      sleep 1
      ping_redis && return 0
    fi
    return 1
  }

  install_redis_conda() {
    local MAMBA="${MAMBA:-${HOME}/miniforge3/bin/mamba}"
    [[ -x "$MAMBA" ]] || return 1
    export PATH="${HOME}/miniforge3/bin:${PATH:-}"
    echo "==> installing redis-server via conda-forge (user space)"
    "$MAMBA" install -y -c conda-forge redis >/dev/null 2>&1 || "$MAMBA" install -y -c conda-forge redis-server >/dev/null 2>&1 || true
    command -v redis-server >/dev/null 2>&1
  }

  if ping_redis; then
    echo "Redis OK on port ${port}"
  elif start_user_redis; then
    echo "Redis started (user daemon, ${REDIS_DIR})"
  elif install_redis_conda && start_user_redis; then
    echo "Redis installed via conda and started"
  else
    echo "WARN: Redis not reachable — QRP uses in-process cache fallback only" >&2
    upsert_env QRE_CACHE_ENABLED true
    upsert_env QRE_REDIS_URL ""
    return 0
  fi

  upsert_env QRE_REDIS_URL "$url"
  upsert_env QRE_CACHE_ENABLED true
  echo "backend/.env: QRE_REDIS_URL=${url} QRE_CACHE_ENABLED=true"
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  ROOT="$(cd "$(dirname "$0")/.." && pwd)"
  ensure_qre_redis_cache "$ROOT"
fi
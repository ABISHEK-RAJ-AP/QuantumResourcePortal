"""Redis/Valkey cache with in-process fallback (TeleScope pattern, QRE namespace).

Signed-in sessions and lockout counters stay in PostgreSQL (LLD §11.3). Redis holds ephemeral
data: CAPTCHA challenges, hot read caches, and future rate-limit keys.
"""

from __future__ import annotations

import json
import logging
import threading
import time
from typing import Any

from qre.core.config import Settings, get_settings

logger = logging.getLogger(__name__)

_client = None
_client_checked = False
_stats = {"hits": 0, "misses": 0, "errors": 0}
_mem_lock = threading.Lock()
_mem: dict[str, tuple[float, Any]] = {}


def _namespace(settings: Settings) -> str:
    return settings.cache_namespace


def cache_key(settings: Settings, *parts: str) -> str:
    return f"{_namespace(settings)}:{':'.join(p for p in parts if p)}"


def _enabled(settings: Settings) -> bool:
    return settings.cache_enabled and bool(settings.redis_url)


def get_client(settings: Settings | None = None):
    settings = settings or get_settings()
    if not _enabled(settings):
        return None
    global _client, _client_checked
    if _client_checked:
        return _client
    _client_checked = True
    url = settings.redis_url or ""
    try:
        import redis

        _client = redis.from_url(url, decode_responses=True, socket_connect_timeout=2)
        _client.ping()
        logger.info("Redis cache connected (%s)", url.split("@")[-1])
    except Exception as exc:
        logger.warning("Redis unavailable — using in-process fallback: %s", exc)
        _client = None
        _stats["errors"] += 1
    return _client


def cache_get_json(key: str, settings: Settings | None = None) -> Any | None:
    settings = settings or get_settings()
    r = get_client(settings)
    if not r:
        return _mem_get(key, 3600)
    try:
        raw = r.get(key)
        if raw is None:
            _stats["misses"] += 1
            return None
        _stats["hits"] += 1
        return json.loads(raw)
    except Exception as exc:
        logger.debug("cache get %s: %s", key, exc)
        _stats["errors"] += 1
        return None


def cache_set_json(key: str, value: Any, ttl_sec: int, settings: Settings | None = None) -> None:
    settings = settings or get_settings()
    if ttl_sec <= 0:
        return
    r = get_client(settings)
    if not r:
        _mem_set(key, value)
        return
    try:
        r.setex(key, ttl_sec, json.dumps(value, default=str))
    except Exception as exc:
        logger.debug("cache set %s: %s", key, exc)
        _stats["errors"] += 1
        _mem_set(key, value)


def cache_delete(key: str, settings: Settings | None = None) -> None:
    settings = settings or get_settings()
    r = get_client(settings)
    with _mem_lock:
        _mem.pop(key, None)
    if not r:
        return
    try:
        r.delete(key)
    except Exception as exc:
        logger.debug("cache delete %s: %s", key, exc)


def _mem_get(key: str, ttl_sec: int) -> Any | None:
    now = time.time()
    with _mem_lock:
        hit = _mem.get(key)
        if hit and now - hit[0] < ttl_sec:
            return hit[1]
    return None


def _mem_set(key: str, value: Any) -> None:
    with _mem_lock:
        _mem[key] = (time.time(), value)


def cache_health(settings: Settings | None = None) -> dict[str, Any]:
    settings = settings or get_settings()
    base: dict[str, Any] = {
        "enabled": settings.cache_enabled,
        "redis_configured": bool(settings.redis_url),
        "namespace": _namespace(settings),
        "stats": dict(_stats),
    }
    if not settings.cache_enabled:
        base["connected"] = False
        base["backend"] = "disabled"
        return base
    if not settings.redis_url:
        base["connected"] = False
        base["backend"] = "memory_fallback"
        base["detail"] = "QRE_REDIS_URL not set"
        return base
    r = get_client(settings)
    if not r:
        base["connected"] = False
        base["backend"] = "memory_fallback"
        return base
    try:
        t0 = time.perf_counter()
        r.ping()
        base["connected"] = True
        base["backend"] = "redis"
        base["latency_ms"] = round((time.perf_counter() - t0) * 1000, 2)
    except Exception as exc:
        base["connected"] = False
        base["backend"] = "memory_fallback"
        base["error"] = str(exc)
    return base


def cache_readiness(settings: Settings) -> tuple[bool, str]:
    """Lab/production: when cache is enabled and Redis URL is set, readiness expects a live ping."""
    if not settings.cache_enabled:
        return True, "cache disabled"
    if not settings.redis_url:
        if settings.is_lab:
            return True, "cache enabled; no QRE_REDIS_URL (in-memory fallback only)"
        return False, "QRE_CACHE_ENABLED without QRE_REDIS_URL"
    health = cache_health(settings)
    if health.get("connected"):
        return True, f"redis ok ({health.get('latency_ms')} ms)"
    err = health.get("error") or health.get("detail") or "not connected"
    if settings.is_lab:
        return True, f"redis unreachable — fallback active: {err}"
    return False, f"redis required but unreachable: {err}"
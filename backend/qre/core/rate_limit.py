"""Per-IP rate limits for unauthenticated auth endpoints (Condom SEC-ABUSE-01)."""

from __future__ import annotations

import time

from qre.core.cache import _mem_lock, _namespace, cache_key, get_client
from qre.core.config import Settings, get_settings
from qre.core.errors import QreError


class RateLimited(QreError):
    code = "RATE_LIMITED"

    def __init__(self, *, retry_after_sec: int, headers: dict[str, str] | None = None) -> None:
        retry = max(1, retry_after_sec)
        self.retry_after_sec = retry
        hdr = dict(headers or {})
        hdr.setdefault("Retry-After", str(retry))
        super().__init__(
            detail="Too many requests from this address. Try again later.",
            headers=hdr,
        )


_mem_buckets: dict[str, tuple[float, int]] = {}


def _incr_redis(key: str, window_sec: int, settings: Settings) -> tuple[int, int]:
    r = get_client(settings)
    if not r:
        raise RuntimeError("no redis")
    count = int(r.incr(key))
    ttl = int(r.ttl(key))
    if ttl < 0:
        r.expire(key, window_sec)
        ttl = window_sec
    return count, ttl


def _incr_memory(key: str, window_sec: int) -> tuple[int, int]:
    now = time.time()
    with _mem_lock:
        start, count = _mem_buckets.get(key, (now, 0))
        if now - start >= window_sec:
            start, count = now, 0
        count += 1
        _mem_buckets[key] = (start, count)
        retry = max(1, int(window_sec - (now - start)))
    return count, retry


def auth_ip_bucket_count(settings: Settings, ip: str, bucket: str) -> tuple[int, int]:
    """Return (count in window, retry_after_seconds). ponytail: one counter per IP+bucket."""
    window = settings.auth_ip_rate_window_sec
    safe_ip = (ip or "unknown").replace(":", "_")[:64]
    key = cache_key(settings, "ratelimit", bucket, safe_ip)
    try:
        if get_client(settings):
            return _incr_redis(key, window, settings)
    except Exception:
        pass
    return _incr_memory(key, window)


def enforce_auth_ip_rate_limit(
    settings: Settings | None = None,
    *,
    ip: str,
    bucket: str = "auth",
) -> None:
    settings = settings or get_settings()
    limit = settings.auth_ip_rate_limit
    count, retry = auth_ip_bucket_count(settings, ip, bucket)
    if count > limit:
        raise RateLimited(
            retry_after_sec=retry,
            headers={"Retry-After": str(retry)},
        )
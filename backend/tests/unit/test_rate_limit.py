"""Auth IP rate limit — must block after the configured ceiling."""

from qre.core.config import Settings, Profile
from qre.core.rate_limit import RateLimited, enforce_auth_ip_rate_limit


def _settings(limit: int = 5) -> Settings:
    return Settings(
        env=Profile.LAB,
        database_url="postgresql+asyncpg://u:p@localhost/qre",
        auth_ip_rate_limit=limit,
        auth_ip_rate_window_sec=60,
        cache_enabled=False,
        redis_url=None,
    )


def test_rate_limit_blocks_after_limit():
    s = _settings(5)
    ip = "203.0.113.9"
    for _ in range(5):
        enforce_auth_ip_rate_limit(s, ip=ip, bucket="login")
    try:
        enforce_auth_ip_rate_limit(s, ip=ip, bucket="login")
        raise AssertionError("expected RateLimited")
    except RateLimited as exc:
        assert exc.retry_after_sec >= 1
        assert exc.headers.get("Retry-After")
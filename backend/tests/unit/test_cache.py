from qre.core.cache import cache_delete, cache_get_json, cache_key, cache_readiness, cache_set_json
from qre.core.config import Profile, Settings


def test_cache_memory_fallback_without_redis():
    settings = Settings(
        database_url="postgresql+asyncpg://u:p@localhost/qre",
        env=Profile.LAB,
        cache_enabled=True,
        redis_url=None,
    )
    key = cache_key(settings, "test", "a")
    cache_set_json(key, {"v": 1}, 60, settings)
    assert cache_get_json(key, settings) == {"v": 1}
    cache_delete(key, settings)
    assert cache_get_json(key, settings) is None


def test_cache_readiness_lab_without_url():
    settings = Settings(database_url="postgresql+asyncpg://u:p@localhost/qre", env=Profile.LAB, redis_url=None)
    ok, detail = cache_readiness(settings)
    assert ok is True
    assert "fallback" in detail.lower() or "no" in detail.lower()
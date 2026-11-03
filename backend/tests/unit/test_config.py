import pytest
from pydantic import ValidationError

from qre.core.config import Profile, Settings

DSN = "postgresql+asyncpg://qre_app:secret@localhost:5432/qre"


def make(**kwargs) -> Settings:
    return Settings(_env_file=None, database_url=kwargs.pop("database_url", DSN), **kwargs)


def test_defaults_follow_appendix_d():
    s = make()
    assert s.env is Profile.LAB
    assert (s.page_size_default, s.page_size_max) == (25, 200)
    assert (s.session_idle_min, s.session_absolute_h) == (30, 12)
    assert s.feature_svc05_enabled is False
    assert s.rls_enabled is False


def test_sync_driver_is_rejected():
    with pytest.raises(ValidationError, match="postgresql\\+asyncpg"):
        make(database_url="postgresql://u:p@localhost/qre")


def test_cors_origins_parsed_from_comma_list():
    s = make(cors_origins="https://a.example, https://b.example")
    assert s.cors_origins == ["https://a.example", "https://b.example"]


def test_page_size_cross_field_rule():
    with pytest.raises(ValidationError, match="PAGE_SIZE_DEFAULT"):
        make(page_size_default=150, page_size_max=100)


def test_production_requires_explicit_security_settings():
    with pytest.raises(ValidationError) as exc:
        make(env="production")
    message = str(exc.value)
    assert "QRE_MFA_REQUIRED" in message
    assert "TLS" in message
    assert "QRE_CORS_ORIGINS" in message


def test_production_accepts_complete_configuration():
    s = make(
        env="production",
        database_url=DSN + "?ssl=verify-full",
        mfa_required=True,
        cors_origins="https://qre.example",
    )
    assert s.env is Profile.PRODUCTION


def test_masked_hides_database_password():
    masked = make().masked()
    assert "secret" not in masked["database_url"]
    assert masked["database_url"].startswith("postgresql+asyncpg://qre_app:***@")

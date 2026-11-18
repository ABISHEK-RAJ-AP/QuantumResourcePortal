from qre.core.config import Profile, Settings
from qre.services.svc02_identity.capabilities import build_auth_capabilities, identity_mfa_readiness


def test_build_auth_capabilities_lab():
    caps = build_auth_capabilities(Settings(database_url="postgresql+asyncpg://u:p@localhost/qre", env=Profile.LAB))
    assert caps["profile"] == "lab"
    assert caps["federation"]["local_login"] is True
    assert caps["mfa_verification_available"] is False
    assert caps["password_self_service"] is False
    assert caps["session"]["store"] == "postgresql"
    assert "backend" in caps["cache"]


def test_mfa_readiness_fails_when_required_without_verification():
    settings = Settings(
        database_url="postgresql+asyncpg://u:p@localhost/qre",
        env=Profile.LAB,
        mfa_required=True,
    )
    ok, detail = identity_mfa_readiness(settings)
    assert ok is False
    assert "D-13" in detail


def test_mfa_readiness_ok_when_not_required():
    settings = Settings(database_url="postgresql+asyncpg://u:p@localhost/qre", env=Profile.LAB)
    ok, _ = identity_mfa_readiness(settings)
    assert ok is True
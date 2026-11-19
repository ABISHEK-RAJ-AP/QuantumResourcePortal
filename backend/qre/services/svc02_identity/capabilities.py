"""Public deployment capabilities — what auth and optional features are actually available."""

from __future__ import annotations

from qre.core.cache import cache_health
from qre.core.config import APP_VERSION, Settings

# Decision D-13: verification/enrolment endpoints not shipped; flag stays explicit for readiness.
MFA_VERIFICATION_AVAILABLE = False
PASSWORD_SELF_SERVICE_AVAILABLE = False
def build_auth_capabilities(settings: Settings) -> dict:
    self_registration = settings.org_self_register_enabled
    return {
        "version": APP_VERSION,
        "profile": settings.env.value,
        "captcha_enabled": settings.captcha_enabled,
        "mfa_required": settings.mfa_required,
        "mfa_verification_available": MFA_VERIFICATION_AVAILABLE,
        "mfa_enrollment_available": False,
        "password_self_service": PASSWORD_SELF_SERVICE_AVAILABLE,
        "self_registration": self_registration,
        "organization_registration": self_registration,
        "federation": {"oidc": False, "saml": False, "local_login": True},
        "features": {
            "procurement_entitlements": settings.feature_svc05_enabled,
            "row_level_security": settings.rls_enabled,
            "demo_seed": settings.is_lab,
            "demo_simulation": settings.is_lab,
        },
        "session": {
            "store": "postgresql",
            "idle_minutes": settings.session_idle_min,
            "absolute_hours": settings.session_absolute_h,
            "cookie_secure": settings.cookie_secure,
        },
        "cache": cache_health(settings),
        "roadmap": {
            "mfa_methods_planned": ["totp", "oidc", "saml"],
        },
    }


def identity_mfa_readiness(settings: Settings) -> tuple[bool, str]:
    if settings.mfa_required and not MFA_VERIFICATION_AVAILABLE:
        return (
            False,
            "QRE_MFA_REQUIRED is true but MFA verification is not implemented (decision D-13). "
            "Set QRE_MFA_REQUIRED=false for lab or ship MFA before production.",
        )
    if settings.mfa_required:
        return True, "MFA required when verification module is enabled"
    return True, "MFA not required for this profile"
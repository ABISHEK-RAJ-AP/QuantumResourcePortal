"""Public organization registration — creates tenant + first PLATFORM_ADMIN (lab / explicit flag)."""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from qre.core.config import Settings
from qre.core.errors import FieldError, ValidationFailed
from qre.services.svc02_identity.bootstrap import BootstrapError, BootstrapResult, bootstrap_admin


@dataclass(frozen=True)
class OrgRegisterIn:
    tenant_code: str
    tenant_name: str
    admin_username: str
    admin_display_name: str
    password: str
    confirm_password: str
    email: str | None = None
    org_kind: str | None = None  # advisory label (startup, academia, …) — not persisted in phase 1


class OrgRegistrationDisabled(Exception):
    pass


def _map_bootstrap_error(exc: BootstrapError) -> ValidationFailed:
    msg = str(exc)
    field_errors: list[FieldError] = []
    low = msg.lower()
    if "tenant code" in low:
        field_errors.append(FieldError("tenant_code", "INVALID", msg))
    elif "username" in low:
        field_errors.append(FieldError("admin_username", "INVALID", msg))
    elif "password" in low:
        field_errors.append(FieldError("password", "INVALID", msg))
    elif "already has" in low or "already exists" in low:
        field_errors.append(FieldError("tenant_code", "CONFLICT", msg))
    else:
        field_errors.append(FieldError("_form", "INVALID", msg))
    return ValidationFailed(field_errors=field_errors)


async def register_organization(
    session: AsyncSession,
    settings: Settings,
    body: OrgRegisterIn,
) -> BootstrapResult:
    if not settings.org_self_register_enabled:
        raise OrgRegistrationDisabled()
    if body.password != body.confirm_password:
        raise ValidationFailed(
            field_errors=[FieldError("confirm_password", "MISMATCH", "Passwords do not match.")],
        )

    def _run(sync_conn) -> BootstrapResult:
        try:
            return bootstrap_admin(
                sync_conn,
                tenant_code=body.tenant_code,
                tenant_name=body.tenant_name,
                admin_username=body.admin_username,
                password=body.password,
                email=body.email,
                display_name=body.admin_display_name.strip() or "Organization administrator",
            )
        except BootstrapError as exc:
            raise _map_bootstrap_error(exc) from exc

    return await session.run_sync(_run)
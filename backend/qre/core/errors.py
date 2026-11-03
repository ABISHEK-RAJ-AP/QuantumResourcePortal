"""QRE error hierarchy and catalogue (LLD §10.1–10.3, Appendix C).

Domain code raises ``QreError`` (or a subclass). The gateway turns it into an
``application/problem+json`` response. Messages are client-safe: they never reveal other
tenants' data, account existence, stack traces, SQL or credentials.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True, slots=True)
class ErrorSpec:
    status: int
    category: str
    title: str
    retryable: bool = False


# Appendix C — complete catalogue (48 codes). Keep in sync with the LLD.
CATALOGUE: dict[str, ErrorSpec] = {
    "VALIDATION_FAILED": ErrorSpec(
        400, "Validation", "One or more fields are invalid. See field_errors."
    ),
    "MALFORMED_REQUEST": ErrorSpec(400, "Validation", "Request body could not be parsed as JSON."),
    "UNSUPPORTED_MEDIA_TYPE": ErrorSpec(
        415, "Validation", "Content type is not supported for this endpoint."
    ),
    "FORMAT_NOT_SUPPORTED": ErrorSpec(
        415, "Validation", "The file format is not enabled by deployment policy."
    ),
    "PAYLOAD_TOO_LARGE": ErrorSpec(413, "Edge", "Request body exceeds the permitted size."),
    "RATE_LIMITED": ErrorSpec(
        429, "Edge", "Too many requests. Retry after the indicated interval.", True
    ),
    "IDEMPOTENCY_KEY_REUSED": ErrorSpec(
        409, "Validation", "Idempotency-Key was already used with a different request body."
    ),
    "IDEMPOTENCY_IN_PROGRESS": ErrorSpec(
        409, "Validation", "A request with this Idempotency-Key is still being processed.", True
    ),
    "AUTH_REQUIRED": ErrorSpec(401, "Authentication", "Authentication is required."),
    "AUTH_INVALID_CREDENTIALS": ErrorSpec(
        401, "Authentication", "Sign-in failed. Check your credentials and try again."
    ),
    "AUTH_SESSION_EXPIRED": ErrorSpec(
        401, "Authentication", "Your session has expired. Please sign in again."
    ),
    "AUTH_MFA_REQUIRED": ErrorSpec(401, "Authentication", "Additional verification is required."),
    "AUTH_MFA_INVALID": ErrorSpec(401, "Authentication", "The verification code is not valid."),
    "AUTH_FEDERATION_REQUIRED": ErrorSpec(
        409, "Authentication", "This account signs in through the institutional identity provider."
    ),
    "AUTH_CSRF_FAILED": ErrorSpec(
        403, "Authentication", "Request verification failed. Reload the page and retry."
    ),
    "AUTH_FORBIDDEN": ErrorSpec(
        403, "Authorization", "You do not have permission to perform this action."
    ),
    "RESOURCE_NOT_FOUND": ErrorSpec(
        404, "Authorization / Lookup", "The requested resource was not found."
    ),
    "TENANT_CONTEXT_INVALID": ErrorSpec(
        403, "Authorization", "The active tenant is not available to this account."
    ),
    "TEMPLATE_NOT_PERMITTED": ErrorSpec(
        403, "Authorization", "Your role may only create projects from the assigned templates."
    ),
    "SOD_VIOLATION": ErrorSpec(
        403, "Authorization", "Submitters cannot approve their own workload."
    ),
    "INVALID_STATE_TRANSITION": ErrorSpec(
        409, "State", "The action is not allowed in the current state."
    ),
    "REVISION_CONFLICT": ErrorSpec(
        409, "State", "The resource was changed by someone else. Reload and merge."
    ),
    "DUPLICATE_NATIVE_ID": ErrorSpec(
        409, "State", "An asset with this native identifier already exists for this provider."
    ),
    "WORKLOAD_NOT_AUTHORIZED": ErrorSpec(
        409, "State", "Dispatch is not authorised for this workload."
    ),
    "DISPATCH_IN_PROGRESS": ErrorSpec(
        409, "State", "A dispatch attempt for this workload is already in progress."
    ),
    "DISPATCH_UNRESOLVED": ErrorSpec(
        409, "State", "The previous dispatch outcome is unresolved. Reconciliation is required."
    ),
    "MANUAL_RECONCILIATION_REQUIRED": ErrorSpec(
        409, "State", "Automatic retry is blocked; an operator must reconcile."
    ),
    "PROVIDER_SUSPENDED": ErrorSpec(
        409, "State", "The provider is suspended. New dispatch is blocked."
    ),
    "BACKEND_UNAVAILABLE": ErrorSpec(
        409, "State", "The backend is not operational or is under maintenance lockout."
    ),
    "QUOTA_INSUFFICIENT": ErrorSpec(409, "State", "Quota is insufficient for this request."),
    "RESERVATION_CONFLICT": ErrorSpec(
        409, "State", "The requested window overlaps an existing reservation."
    ),
    "SPEC_IMMUTABLE": ErrorSpec(
        409,
        "State",
        "This specification version is referenced by an approved run and cannot be changed.",
    ),
    "GATE_APPROVAL_REQUIRED": ErrorSpec(
        409, "State", "Human approval is required before this step."
    ),
    "PREFLIGHT_FAILED": ErrorSpec(409, "State", "Preflight reported blocking violations."),
    "MANIFEST_INVALID": ErrorSpec(
        422, "Domain validation", "The capability manifest failed schema validation."
    ),
    "METRIC_NOT_SUPPORTED": ErrorSpec(
        422, "Domain validation", "The metric is not declared by the connector manifest."
    ),
    "OPERATION_NOT_SUPPORTED": ErrorSpec(
        422, "Domain validation", "The connector does not support this operation."
    ),
    "OPERATION_NOT_VERIFIED": ErrorSpec(
        422, "Domain validation", "The connector operation has not passed conformance tests."
    ),
    "IMPORT_VALIDATION_FAILED": ErrorSpec(
        422, "Domain validation", "The import file contains invalid rows. No rows were saved."
    ),
    "COMPILATION_FAILED": ErrorSpec(
        422, "Domain validation", "Source contains errors. See diagnostics."
    ),
    "SIM_CLASS_NOT_REGISTERED": ErrorSpec(
        422, "Domain validation", "No simulator of the requested class is registered."
    ),
    "POLICY_INVALID": ErrorSpec(
        422, "Domain validation", "Approval or quota policy definition is invalid."
    ),
    "EVIDENCE_SERVICE_DISABLED": ErrorSpec(
        501, "Feature", "Evidence and provenance is not enabled for this deployment."
    ),
    "FEATURE_NOT_ENABLED": ErrorSpec(
        501, "Feature", "This capability is not enabled for this deployment."
    ),
    "CONNECTOR_FAILED": ErrorSpec(502, "Dependency", "The external provider returned an error."),
    "CONNECTOR_TIMEOUT": ErrorSpec(
        504, "Dependency", "The external provider did not respond in time."
    ),
    "SERVICE_UNAVAILABLE": ErrorSpec(
        503, "Infrastructure", "The service is temporarily unavailable.", True
    ),
    "INTERNAL_ERROR": ErrorSpec(
        500,
        "Infrastructure",
        "An unexpected error occurred. Quote the correlation id when reporting.",
    ),
}


@dataclass(frozen=True, slots=True)
class FieldError:
    field: str
    code: str
    message: str

    def as_dict(self) -> dict[str, str]:
        return {"field": self.field, "code": self.code, "message": self.message}


class QreError(Exception):
    """Base class for every client-visible error.

    ``code`` must be a key of :data:`CATALOGUE`; HTTP status and title come from it.
    ``detail`` is an optional client-safe sentence specific to this occurrence.
    """

    code: str = "INTERNAL_ERROR"

    def __init__(
        self,
        detail: str | None = None,
        *,
        code: str | None = None,
        field_errors: list[FieldError] | None = None,
        headers: dict[str, str] | None = None,
        extra: dict[str, Any] | None = None,
    ) -> None:
        if code is not None:
            self.code = code
        if self.code not in CATALOGUE:
            raise ValueError(f"Unknown QRE error code: {self.code}")
        self.detail = detail
        self.field_errors = field_errors or []
        self.headers = headers or {}
        self.extra = extra or {}
        super().__init__(detail or self.spec.title)

    @property
    def spec(self) -> ErrorSpec:
        return CATALOGUE[self.code]

    @property
    def status(self) -> int:
        return self.spec.status


class ValidationFailed(QreError):
    code = "VALIDATION_FAILED"


class AuthRequired(QreError):
    code = "AUTH_REQUIRED"


class Forbidden(QreError):
    code = "AUTH_FORBIDDEN"


class ResourceNotFound(QreError):
    """Raised for absent rows *and* rows in another tenant (never 403; REQ-009, PD-09)."""

    code = "RESOURCE_NOT_FOUND"


class InvalidStateTransition(QreError):
    code = "INVALID_STATE_TRANSITION"


class RevisionConflict(QreError):
    code = "REVISION_CONFLICT"


class FeatureNotEnabled(QreError):
    code = "FEATURE_NOT_ENABLED"


class ServiceUnavailable(QreError):
    code = "SERVICE_UNAVAILABLE"

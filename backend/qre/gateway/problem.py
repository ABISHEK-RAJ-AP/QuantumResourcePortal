"""Uniform ``application/problem+json`` error responses (LLD §10.2, RFC 9457 style).

Every error leaving the API has the same shape::

    {"type": ".../QUOTA_INSUFFICIENT", "code": "QUOTA_INSUFFICIENT", "title": "...",
     "status": 409, "detail": "...", "correlation_id": "...", "field_errors": []}
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from qre.core.config import get_settings
from qre.core.errors import CATALOGUE, FieldError, QreError
from qre.core.logging import correlation_id_var
from qre.gateway.middleware.correlation import HEADER

log = logging.getLogger("qre.errors")

PROBLEM_MEDIA_TYPE = "application/problem+json"

_HTTP_STATUS_TO_CODE = {
    400: "MALFORMED_REQUEST",
    401: "AUTH_REQUIRED",
    403: "AUTH_FORBIDDEN",
    404: "RESOURCE_NOT_FOUND",
    413: "PAYLOAD_TOO_LARGE",
    415: "UNSUPPORTED_MEDIA_TYPE",
    429: "RATE_LIMITED",
    503: "SERVICE_UNAVAILABLE",
}


def problem_body(
    code: str,
    *,
    status: int | None = None,
    detail: str | None = None,
    field_errors: list[FieldError] | None = None,
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    spec = CATALOGUE[code]
    body: dict[str, Any] = {
        "type": f"{get_settings().error_type_base}{code}",
        "code": code,
        "title": spec.title,
        "status": status or spec.status,
        "detail": detail or spec.title,
        "correlation_id": correlation_id_var.get(),
        "field_errors": [fe.as_dict() for fe in (field_errors or [])],
    }
    if extra:
        body.update(extra)
    return body


def problem_response(
    code: str,
    *,
    status: int | None = None,
    detail: str | None = None,
    field_errors: list[FieldError] | None = None,
    headers: dict[str, str] | None = None,
    extra: dict[str, Any] | None = None,
) -> JSONResponse:
    body = problem_body(code, status=status, detail=detail, field_errors=field_errors, extra=extra)
    all_headers = dict(headers or {})
    if body["correlation_id"]:
        all_headers[HEADER] = body["correlation_id"]
    return JSONResponse(
        body, status_code=body["status"], headers=all_headers, media_type=PROBLEM_MEDIA_TYPE
    )


def _field_name(loc: tuple[Any, ...]) -> str:
    # ('body', 'shots') -> 'shots'; ('query', 'page_size') -> 'page_size'
    parts = [str(p) for p in loc if p not in ("body", "query", "path", "header", "cookie")]
    return ".".join(parts) or "body"


async def handle_qre_error(_: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, QreError)
    return problem_response(
        exc.code,
        detail=exc.detail,
        field_errors=exc.field_errors,
        headers=exc.headers,
        extra=exc.extra,
    )


async def handle_validation_error(_: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, RequestValidationError)
    errors = exc.errors()
    if any(err.get("type") == "json_invalid" for err in errors):
        return problem_response("MALFORMED_REQUEST")
    field_errors = [
        FieldError(
            field=_field_name(tuple(err.get("loc", ()))),
            code=str(err.get("type", "invalid")).upper(),
            message=str(err.get("msg", "Invalid value")),
        )
        for err in errors
    ]
    return problem_response("VALIDATION_FAILED", field_errors=field_errors)


async def handle_http_exception(_: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, StarletteHTTPException)
    code = _HTTP_STATUS_TO_CODE.get(exc.status_code, "MALFORMED_REQUEST")
    headers = dict(exc.headers or {})
    detail = None
    if exc.status_code == 405:
        detail = "The HTTP method is not allowed for this endpoint."
    return problem_response(code, status=exc.status_code, detail=detail, headers=headers)


def internal_error_response(exc: BaseException) -> JSONResponse:
    """500 response for unhandled exceptions; called by CorrelationMiddleware.

    The stack trace goes to the log only; the client gets the correlation id (LLD §4.2.4).
    """
    log.error("unhandled exception", exc_info=exc)
    return problem_response("INTERNAL_ERROR")


def install_problem_handlers(app: FastAPI) -> None:
    app.add_exception_handler(QreError, handle_qre_error)
    app.add_exception_handler(RequestValidationError, handle_validation_error)
    app.add_exception_handler(StarletteHTTPException, handle_http_exception)
    # Unhandled exceptions are converted by CorrelationMiddleware (see internal_error_response).

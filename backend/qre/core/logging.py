"""Structured logging (LLD §10.6, §10.8).

One JSON object per line with timestamp, level, logger, message, correlation id and any
``extra`` fields. Keys that look like secrets are masked before they are written.
"""

from __future__ import annotations

import contextvars
import json
import logging
import re
import sys
from datetime import UTC, datetime
from typing import Any

correlation_id_var: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "correlation_id", default=None
)

_SECRET_KEY = re.compile(r"(password|secret|token|authorization|cookie|private_key|api_key)", re.I)
_STANDARD_ATTRS = set(logging.LogRecord("", 0, "", 0, "", None, None).__dict__) | {
    "message",
    "asctime",
    "taskName",
}


def mask(value: Any) -> Any:
    """Recursively replace values whose key looks secret with '***' (LLD §4.18.1 rule 2)."""
    if isinstance(value, dict):
        return {
            k: ("***" if isinstance(k, str) and _SECRET_KEY.search(k) else mask(v))
            for k, v in value.items()
        }
    if isinstance(value, list | tuple):
        return [mask(v) for v in value]
    return value


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "ts": datetime.fromtimestamp(record.created, UTC).isoformat(timespec="milliseconds"),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        corr = correlation_id_var.get()
        if corr:
            payload["corr_id"] = corr
        extras = {k: v for k, v in record.__dict__.items() if k not in _STANDARD_ATTRS}
        if extras:
            payload.update(mask(extras))
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str)


class TextFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        corr = correlation_id_var.get() or "-"
        when = self.formatTime(record, "%H:%M:%S")
        base = f"{when} {record.levelname:<7} [{corr}] {record.name}: {record.getMessage()}"
        if record.exc_info:
            base += "\n" + self.formatException(record.exc_info)
        return base


def configure_logging(level: str = "INFO", fmt: str = "json") -> None:
    """Configure the root logger once; uvicorn's loggers propagate into it."""
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter() if fmt == "json" else TextFormatter())
    root = logging.getLogger()
    root.handlers[:] = [handler]
    root.setLevel(level)
    # Our access log replaces uvicorn's (it includes correlation id and duration).
    logging.getLogger("uvicorn.access").disabled = True
    for name in ("uvicorn", "uvicorn.error"):
        logging.getLogger(name).handlers.clear()
        logging.getLogger(name).propagate = True

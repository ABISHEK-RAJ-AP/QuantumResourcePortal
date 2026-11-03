"""Identifier helpers (HLD §7.2, LLD §4.1.3–4.1.4, REQ-D001).

Every primary key is a 26-character Crockford base32 ULID stored as CHAR(26).
"""

from __future__ import annotations

import re
import threading

from ulid import ULID

ULID_PATTERN = re.compile(r"^[0-9A-HJKMNP-TV-Z]{26}$")
"""Regex from LLD §4.1.4 (Crockford alphabet, upper case, no I L O U)."""

_lock = threading.Lock()
_last: ULID | None = None


def new_ulid() -> str:
    """Return a new ULID string, monotonic within the process.

    Two ULIDs generated in the same millisecond are ordered by incrementing the random part,
    so sorting by id preserves creation order (LLD §4.1.3, property test TC-DAT-*).
    """
    global _last
    with _lock:
        candidate = ULID()
        if _last is not None and candidate.milliseconds == _last.milliseconds:
            candidate = ULID.from_int(int(_last) + 1)
        elif _last is not None and int(candidate) <= int(_last):
            candidate = ULID.from_int(int(_last) + 1)
        _last = candidate
        return str(candidate)


def is_ulid(value: str) -> bool:
    """True when *value* is a syntactically valid ULID string."""
    return bool(ULID_PATTERN.fullmatch(value))

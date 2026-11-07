"""Password hashing and credential helpers (LLD §4.3.6, §11.1).

Argon2id with the LLD PD-12 parameters (m=64 MiB, t=3, p=1). The hash string carries its
own parameters, so a later cost change re-verifies old hashes and :func:`needs_rehash`
signals when to upgrade them. Credential material never leaves this module as plaintext.
"""

from __future__ import annotations

import hashlib
import hmac
import secrets

from argon2 import PasswordHasher
from argon2 import exceptions as argon2_exceptions

# LLD §4.3.6: m=64 MiB, t=3, p=1. argon2-cffi takes memory in KiB.
_hasher = PasswordHasher(memory_cost=64 * 1024, time_cost=3, parallelism=1)

# A fixed, syntactically valid Argon2id hash of a random secret, used to equalise timing for
# unknown users (REQ-007): verifying against it costs the same as a real verification.
_DUMMY_HASH = _hasher.hash(secrets.token_hex(16))


def hash_password(password: str) -> str:
    """Return an Argon2id hash string (algorithm + parameters + salt + digest)."""
    return _hasher.hash(password)


def verify_password(stored_hash: str | None, password: str) -> bool:
    """Constant-ish time verify. When *stored_hash* is None (unknown user) a dummy verify
    runs so the timing matches a real check, then False is returned (REQ-007)."""
    target = stored_hash or _DUMMY_HASH
    try:
        _hasher.verify(target, password)
    except (argon2_exceptions.VerifyMismatchError, argon2_exceptions.InvalidHashError, Exception):
        return False
    return stored_hash is not None


def needs_rehash(stored_hash: str) -> bool:
    """True when *stored_hash* was made with weaker parameters than the current policy."""
    try:
        return _hasher.check_needs_rehash(stored_hash)
    except argon2_exceptions.InvalidHashError:
        return True


def sha256_hex(value: str) -> str:
    """SHA-256 hex digest — used for session id / CSRF / token at-rest keys (LLD §4.3.1)."""
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def new_session_token() -> str:
    """Opaque 256-bit session id placed in the qre_sid cookie (LLD §11.3)."""
    return secrets.token_urlsafe(32)


def new_csrf_token() -> str:
    """128-bit CSRF synchroniser token (LLD §4.3.1)."""
    return secrets.token_urlsafe(16)


def constant_time_equals(a: str, b: str) -> bool:
    """Timing-safe comparison for CSRF and token checks."""
    return hmac.compare_digest(a, b)

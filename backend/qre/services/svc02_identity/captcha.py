"""In-memory image CAPTCHA for lab deployments (SRS §4.2.1). SVG-only — no Pillow dependency."""

from __future__ import annotations

import hmac
import random
import secrets
import threading
import time
import base64
from dataclasses import dataclass

from qre.core.errors import FieldError, ValidationFailed

CAPTCHA_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
CAPTCHA_LEN = 5
CAPTCHA_TTL_SECONDS = 300

_STORE: dict[str, dict[str, float | str]] = {}
_LOCK = threading.Lock()


def _cleanup() -> None:
    now = time.time()
    expired = [cid for cid, row in _STORE.items() if float(row["expires_at"]) < now]
    for cid in expired:
        _STORE.pop(cid, None)


def _svg(code: str) -> str:
    width, height = 220, 72
    colors = ["#1d4ed8", "#7c3aed", "#047857", "#b45309", "#b91c1c", "#4338ca"]
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">',
        '<rect width="100%" height="100%" fill="#efe8d8"/>',
    ]
    for _ in range(40):
        parts.append(
            f'<circle cx="{random.randint(4, width - 4)}" cy="{random.randint(4, height - 4)}" '
            f'r="{random.uniform(0.6, 2.2)}" fill="{random.choice(["#c4b89a", "#8b7d62", "#64748b"])}" opacity="0.55"/>'
        )
    for _ in range(5):
        parts.append(
            f'<line x1="{random.randint(0, 40)}" y1="{random.randint(8, height - 8)}" '
            f'x2="{random.randint(width - 50, width)}" y2="{random.randint(8, height - 8)}" '
            f'stroke="{random.choice(colors)}" stroke-width="{random.uniform(1.1, 2.0)}" opacity="0.45"/>'
        )
    spacing = (width - 24) / max(len(code), 1)
    for i, ch in enumerate(code):
        cx = 16 + i * spacing + random.uniform(-2, 2)
        cy = random.randint(44, 52)
        rot = random.randint(-22, 22)
        parts.append(
            f'<text x="{cx}" y="{cy}" font-family="DejaVu Sans, Liberation Sans, sans-serif" '
            f'font-size="{random.randint(26, 32)}" font-weight="700" fill="{colors[i % len(colors)]}" '
            f'transform="rotate({rot}, {cx}, {cy})">{ch}</text>'
        )
    parts.append("</svg>")
    raw = "".join(parts).encode("utf-8")
    return "data:image/svg+xml;base64," + base64.b64encode(raw).decode("ascii")


@dataclass(frozen=True)
class CaptchaChallenge:
    captcha_id: str
    captcha_image: str
    expires_in_seconds: int


def new_challenge() -> CaptchaChallenge:
    code = "".join(random.choices(CAPTCHA_CHARS, k=CAPTCHA_LEN))
    captcha_id = f"cap_{secrets.token_urlsafe(12)}"
    with _LOCK:
        _cleanup()
        _STORE[captcha_id] = {"code": code, "expires_at": time.time() + CAPTCHA_TTL_SECONDS}
    return CaptchaChallenge(
        captcha_id=captcha_id,
        captcha_image=_svg(code),
        expires_in_seconds=CAPTCHA_TTL_SECONDS,
    )


def verify(captcha_id: str | None, captcha_code: str | None) -> None:
    """Raises ValidationFailed with field_errors when the challenge is missing or wrong."""
    if not captcha_id or not captcha_code or not str(captcha_code).strip():
        raise ValidationFailed(
            field_errors=[
                FieldError("captcha_code", "CAPTCHA_REQUIRED", "Enter the characters shown in the image."),
            ],
        )
    with _LOCK:
        _cleanup()
        stored = _STORE.get(captcha_id)
        if not stored:
            raise ValidationFailed(
                field_errors=[
                    FieldError("captcha_id", "CAPTCHA_EXPIRED", "Challenge expired. Request a new image."),
                ],
            )
        expected = str(stored["code"])
        _STORE.pop(captcha_id, None)
    got = captcha_code.strip().upper()
    want = expected.upper()
    if len(got) != len(want) or not hmac.compare_digest(got, want):
        raise ValidationFailed(
            field_errors=[
                FieldError(
                    "captcha_code",
                    "CAPTCHA_MISMATCH",
                    "Characters do not match the image. Try a new one.",
                ),
            ],
        )
"""Ensure migration 0010 never regresses to JSON-string defaults (SQLAlchemy bind :0 bug)."""

from __future__ import annotations

from pathlib import Path

FORBIDDEN = (
    'pending_jobs":',
    '"nodes":[]',
    'manifest_registered":false',
    'manifest_registered":true',
    "op.execute(",
)


def test_migration_0010_has_no_json_string_defaults():
    path = (
        Path(__file__).resolve().parents[2]
        / "migrations"
        / "versions"
        / "20261118_0010_providers_backends.py"
    )
    body = path.read_text(encoding="utf-8")
    for needle in FORBIDDEN:
        assert needle not in body, f"forbidden fragment in 0010: {needle!r}"
    assert "op.create_table" in body
    assert "jsonb_build_object" in body
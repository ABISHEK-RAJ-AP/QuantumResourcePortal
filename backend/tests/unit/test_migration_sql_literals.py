"""Guard migration DDL against SQLAlchemy ':name' bind parsing in JSON literals."""

from __future__ import annotations

import re
from pathlib import Path

import pytest
from sqlalchemy import text
from sqlalchemy.dialects import postgresql

MIGRATIONS = Path(__file__).resolve().parents[2] / "migrations" / "versions"

# JSON booleans after a colon must be escaped for op.execute() → sqlalchemy.text()
_UNESCAPED_JSON_BOOL = re.compile(r'":(true|false)(?=[\s\'",}\]])', re.IGNORECASE)


def _migration_sql_snippets(path: Path) -> list[str]:
    body = path.read_text(encoding="utf-8")
    return re.findall(r'op\.execute\(\s*"""(.*?)"""', body, re.DOTALL)


@pytest.mark.parametrize(
    "revision_file",
    sorted(MIGRATIONS.glob("*.py")),
    ids=lambda p: p.name,
)
def test_migration_execute_strings_compilable(revision_file: Path) -> None:
    dialect = postgresql.dialect()
    for snippet in _migration_sql_snippets(revision_file):
        stmt = text(snippet.strip())
        compiled = stmt.compile(dialect=dialect)
        compiled.construct_params(compiled.params)

        if revision_file.name.startswith("20261118_0010"):
            assert _UNESCAPED_JSON_BOOL.search(snippet) is None, "escape JSON booleans as \\:true / \\:false"
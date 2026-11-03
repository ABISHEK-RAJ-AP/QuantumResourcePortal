"""Command-line helpers: ``python -m qre <command>``.

Commands
    config-check   Validate configuration and print it with secrets masked (LLD §13.9).
"""

from __future__ import annotations

import json
import sys

from pydantic import ValidationError


def main(argv: list[str]) -> int:
    command = argv[1] if len(argv) > 1 else "help"
    if command == "config-check":
        from qre.core.config import get_settings

        try:
            settings = get_settings()
        except ValidationError as exc:
            print("Configuration is INVALID:\n", file=sys.stderr)
            for err in exc.errors():
                where = ".".join(str(p) for p in err["loc"]) or "settings"
                print(f"  - {where}: {err['msg']}", file=sys.stderr)
            return 2
        print(json.dumps(settings.masked(), indent=2))
        print("\nConfiguration is valid.", file=sys.stderr)
        return 0
    print(__doc__)
    return 0 if command == "help" else 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))

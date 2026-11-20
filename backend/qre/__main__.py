"""Command-line helpers: ``python -m qre <command>``.

Commands
    config-check   Validate configuration and print it with secrets masked (LLD §13.9).
    bootstrap      Create a tenant and its first PLATFORM_ADMIN (installer step, LLD §4.3).
                   Usage:
                     python -m qre bootstrap --tenant-code CDAC --tenant-name "C-DAC Chennai" \
                                             --admin-username admin [--email a@b.in]
                   The password is read from QRE_BOOTSTRAP_PASSWORD, or prompted if a TTY.
    seed-demo      Load interconnected demo data into PostgreSQL (lab only).
                   Usage:
                     python -m qre seed-demo --tenant-code CDAC [--force] [--reset-only]
    seed-demo-reset  Alias for seed-demo --reset-only.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys

from pydantic import ValidationError


def _run_seed_demo(args: argparse.Namespace) -> int:
    from sqlalchemy.ext.asyncio import create_async_engine

    from qre.core.config import get_settings
    from qre.seed.seed_demo import SeedDemoError, seed_demo, seed_demo_reset

    url = get_settings().database_url.get_secret_value()

    async def go() -> int:
        engine = create_async_engine(url)
        try:
            async with engine.begin() as aconn:
                if args.reset_only:
                    payload = await aconn.run_sync(
                        lambda c: seed_demo_reset(c, tenant_code=args.tenant_code)
                    )
                    print(json.dumps({"reset": payload}, indent=2))
                    return 0
                result = await aconn.run_sync(
                    lambda c: seed_demo(
                        c, tenant_code=args.tenant_code, force=bool(args.force)
                    )
                )
        except SeedDemoError as exc:
            print(f"Seed refused: {exc}", file=sys.stderr)
            return 1
        finally:
            await engine.dispose()
        print(
            json.dumps(
                {
                    "tenant_id": result.tenant_id,
                    "tenant_code": result.tenant_code,
                    "created": result.created,
                    "counts": result.counts,
                    "demo_users": result.demo_users,
                    "password": "quantum2026",
                },
                indent=2,
            )
        )
        print(
            "\nDemo seed complete. See docs/development/QRP_DEMO_ENVIRONMENT.md.",
            file=sys.stderr,
        )
        return 0

    return asyncio.run(go())


def _run_bootstrap(args: argparse.Namespace) -> int:
    from getpass import getpass

    from sqlalchemy.ext.asyncio import create_async_engine

    from qre.core.config import get_settings
    from qre.services.svc02_identity.bootstrap import BootstrapError, bootstrap_admin

    password = os.environ.get("QRE_BOOTSTRAP_PASSWORD")
    if not password:
        if not sys.stdin.isatty():
            print(
                "No password: set QRE_BOOTSTRAP_PASSWORD or run interactively.", file=sys.stderr
            )
            return 2
        password = getpass("New PLATFORM_ADMIN password: ")
        if password != getpass("Confirm password: "):
            print("Passwords do not match.", file=sys.stderr)
            return 2

    url = get_settings().database_url.get_secret_value()

    async def go() -> int:
        engine = create_async_engine(url)
        try:
            async with engine.begin() as aconn:
                # bootstrap_admin is sync; run it against the underlying sync-style connection.
                result = await aconn.run_sync(
                    lambda sync_conn: bootstrap_admin(
                        sync_conn,
                        tenant_code=args.tenant_code,
                        tenant_name=args.tenant_name or args.tenant_code,
                        admin_username=args.admin_username,
                        password=password,
                        email=args.email,
                    )
                )
        except BootstrapError as exc:
            print(f"Bootstrap refused: {exc}", file=sys.stderr)
            return 1
        finally:
            await engine.dispose()
        print(
            json.dumps(
                {
                    "tenant_id": result.tenant_id,
                    "tenant_code": result.tenant_code,
                    "created_tenant": result.created_tenant,
                    "admin_user_id": result.user_id,
                    "admin_username": result.admin_username,
                },
                indent=2,
            )
        )
        print("\nBootstrap complete. Sign in with the admin credentials.", file=sys.stderr)
        return 0

    return asyncio.run(go())


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

    if command == "bootstrap":
        parser = argparse.ArgumentParser(prog="qre bootstrap")
        parser.add_argument("--tenant-code", required=True)
        parser.add_argument("--tenant-name", default="")
        parser.add_argument("--admin-username", required=True)
        parser.add_argument("--email", default=None)
        args = parser.parse_args(argv[2:])
        return _run_bootstrap(args)

    if command in ("seed-demo", "seed-demo-reset"):
        parser = argparse.ArgumentParser(prog="qre seed-demo")
        parser.add_argument("--tenant-code", required=True)
        parser.add_argument("--force", action="store_true")
        parser.add_argument(
            "--reset-only",
            action="store_true",
            default=command == "seed-demo-reset",
        )
        args = parser.parse_args(argv[2:])
        return _run_seed_demo(args)

    print(__doc__)
    return 0 if command == "help" else 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))

#!/usr/bin/env python3
"""Validate backend/permissions.yaml and (re)generate docs/RBAC_PERMISSION_MATRIX.md.

This is the RBAC-2 gate. It enforces the rules named at the top of permissions.yaml and
the SRS Appendix B coverage assertions, then renders the human-readable matrix. The
RBAC-3 seed migration loads the same file, so a green run here means the seed is valid.

Usage (from backend/):
    python scripts/validate_permissions.py            # validate + regenerate the doc
    python scripts/validate_permissions.py --check     # validate only; fail if the doc is stale
Exit code is non-zero on any violation, so it can run in CI.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import yaml

BACKEND = Path(__file__).resolve().parents[1]
REPO = BACKEND.parent
PERMS_FILE = BACKEND / "permissions.yaml"
MATRIX_DOC = REPO / "docs" / "RBAC_PERMISSION_MATRIX.md"

SCOPES = {"TENANT", "PROJECT", "PROVIDER"}


def load() -> dict:
    with PERMS_FILE.open(encoding="utf-8") as fh:
        return yaml.safe_load(fh)


def validate(data: dict) -> list[str]:
    """Return a list of human-readable errors (empty = valid)."""
    errors: list[str] = []
    perms = data["permissions"]
    modules = data["modules"]
    roles = data["roles"]

    # Rule 1: unique permission codes
    codes: list[str] = [p["code"] for p in perms]
    dupes = {c for c in codes if codes.count(c) > 1}
    if dupes:
        errors.append(f"Rule 1: duplicate permission codes: {sorted(dupes)}")
    code_set = set(codes)

    # Every permission references a defined module and a known action
    valid_actions = {
        "create", "read", "update", "delete", "approve", "reject",
        "assign", "manage", "execute", "export", "view_audit",
    }
    for p in perms:
        if p["module"] not in modules:
            errors.append(f"permission {p['code']}: unknown module '{p['module']}'")
        if p["action"] not in valid_actions:
            errors.append(f"permission {p['code']}: unknown action '{p['action']}'")

    # Rule 3: role scopes valid; Rule 2: every granted code is defined
    for rname, role in roles.items():
        if role["assignable_scope"] not in SCOPES:
            errors.append(f"Rule 3: role {rname} has invalid scope '{role['assignable_scope']}'")
        for c in role.get("permissions", []):
            if c not in code_set:
                errors.append(f"Rule 2: role {rname} grants undefined permission '{c}'")

    # Rule 5 / invariants: PLATFORM_ADMIN must not hold certain permissions
    inv = data.get("invariants", {})
    pa = set(roles["PLATFORM_ADMIN"]["permissions"])
    for forbidden in inv.get("platform_admin_must_not_hold", []):
        if forbidden in pa:
            errors.append(f"Rule 5: PLATFORM_ADMIN must not hold '{forbidden}' (separation of duties)")

    # Rule 4: SRS Appendix B coverage — every cited permission is held by every listed role
    for entry in data.get("srs_appendix_b", []):
        for rname in entry["roles"]:
            held = set(roles[rname]["permissions"])
            missing = [c for c in entry["satisfied_by"] if c not in held]
            if missing:
                errors.append(
                    f"Rule 4 (SRS App.B): role {rname} is missing {missing} "
                    f"required by cell «{entry['cell']}» — the normative matrix would be reduced"
                )
        for c in entry["satisfied_by"]:
            if c not in code_set:
                errors.append(f"Rule 4: SRS cell «{entry['cell']}» cites undefined permission '{c}'")

    # Sanity: no permission is orphaned (defined but held by no role) except intentionally
    held_by_any = {c for r in roles.values() for c in r.get("permissions", [])}
    orphans = code_set - held_by_any
    if orphans:
        errors.append(f"Warning-as-error: permissions defined but granted to no role: {sorted(orphans)}")

    return errors


def render(data: dict) -> str:
    perms = data["permissions"]
    modules = data["modules"]
    roles = data["roles"]
    role_order = [r for r in roles if not roles[r].get("system_only")]  # ASSISTANT omitted from grid
    abbr = {
        "PLATFORM_ADMIN": "PA", "OPERATOR": "OP", "RESEARCHER": "RS", "PROJECT_OWNER": "PO",
        "QUOTA_APPROVER": "QA", "PROVIDER_ADMIN": "PV", "AUDITOR": "AU", "RESOURCE_MANAGER": "RM",
    }
    held = {r: set(roles[r]["permissions"]) for r in roles}

    def cell(r: str, code: str) -> str:
        if code not in held[r]:
            return "—"
        scope = roles[r]["assignable_scope"]
        return {"TENANT": "✓", "PROJECT": "P", "PROVIDER": "V"}[scope]

    lines: list[str] = []
    lines.append("# QRP RBAC — Permission Matrix (generated)")
    lines.append("")
    lines.append("> **Generated from `backend/permissions.yaml` by `backend/scripts/validate_permissions.py`. Do not edit by hand** —")
    lines.append("> change the YAML and re-run. This file is the human-readable view of the RBAC-3 seed.")
    lines.append("")
    lines.append(f"- Identifier style: `{data['identifier_style']}` (R-02) · Catalogue version: {data['version']}")
    lines.append(f"- **{len(perms)} permissions** across **{len(modules)} modules**, **{len(role_order)} assignable system roles** (+ ASSISTANT service identity, no permissions).")
    lines.append("- Legend: **✓** held tenant-wide · **P** held within an assigned project · **V** held within an assigned provider · **—** denied.")
    lines.append("- Scope comes from each role's `assignable_scope`; the Authorizer narrows a grant to the assignment's project/provider at request time (plan §5.2).")
    lines.append("")
    lines.append("## Roles")
    lines.append("")
    lines.append("| Code | Name | Scope | Permissions | Summary |")
    lines.append("|---|---|---|---:|---|")
    for r in role_order + [x for x in roles if roles[x].get("system_only")]:
        role = roles[r]
        lines.append(f"| `{r}` | {role['name']} | {role['assignable_scope']} | {len(role['permissions'])} | {role['description']} |")
    lines.append("")
    lines.append("## Matrix")
    lines.append("")
    header = "| Module | Permission | " + " | ".join(abbr[r] for r in role_order) + " | Basis |"
    sep = "|---|---|" + "|".join([":-:"] * len(role_order)) + "|---|"
    lines.append(header)
    lines.append(sep)
    last_mod = None
    for p in perms:
        mod = p["module"]
        mlabel = modules[mod]["label"]
        flag = ""
        if modules[mod].get("flagged"):
            flag = f" *(flag: {modules[mod]['flagged']})*"
        elif modules[mod].get("deferred"):
            flag = " *(deferred — R-09)*"
        mod_cell = (mlabel + flag) if mod != last_mod else ""
        last_mod = mod
        row = f"| {mod_cell} | `{p['code']}` | " + " | ".join(cell(r, p["code"]) for r in role_order) + f" | {p.get('basis','')} |"
        lines.append(row)
    lines.append("")
    lines.append("## SRS Appendix B validation")
    lines.append("")
    lines.append("Every normative SRS Appendix B cell below is satisfied by the permissions shown (checked by the validator; the build fails if any is reduced).")
    lines.append("")
    lines.append("| SRS Appendix B cell | Roles | Satisfied by |")
    lines.append("|---|---|---|")
    for e in data["srs_appendix_b"]:
        lines.append(f"| {e['cell']} | {', '.join(e['roles'])} | {', '.join('`'+c+'`' for c in e['satisfied_by'])} |")
    lines.append("")
    lines.append("## Invariants")
    lines.append("")
    lines.append(f"- **Deny by default:** {data['invariants']['deny_by_default']}.")
    lines.append(f"- **PLATFORM_ADMIN must not hold:** {', '.join('`'+c+'`' for c in data['invariants']['platform_admin_must_not_hold'])} — enforced so administrators cannot decide approvals (separation of duties, LLD §11.2).")
    lines.append("")
    lines.append("## Privileged permissions")
    lines.append("")
    priv = [p["code"] for p in perms if p.get("privileged")]
    lines.append("Grantable only by `PLATFORM_ADMIN`; guarded by the anti-escalation policy (plan §9, S-2):")
    lines.append("")
    lines.append(", ".join(f"`{c}`" for c in priv))
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="validate only; fail if the doc is stale")
    args = ap.parse_args()

    data = load()
    errors = validate(data)
    if errors:
        print("permissions.yaml INVALID:\n", file=sys.stderr)
        for e in errors:
            print(f"  - {e}", file=sys.stderr)
        return 1

    rendered = render(data)
    if args.check:
        current = MATRIX_DOC.read_text(encoding="utf-8") if MATRIX_DOC.exists() else ""
        if current.strip() != rendered.strip():
            print("RBAC_PERMISSION_MATRIX.md is stale — run: python scripts/validate_permissions.py", file=sys.stderr)
            return 2
        print("permissions.yaml valid; matrix doc up to date.")
        return 0

    MATRIX_DOC.write_text(rendered + "\n", encoding="utf-8")
    nperm = len(data["permissions"])
    nrole = sum(1 for r in data["roles"].values() if not r.get("system_only"))
    print(f"permissions.yaml valid. {nperm} permissions, {nrole} assignable roles, "
          f"{len(data['srs_appendix_b'])} SRS Appendix B cells covered.")
    print(f"Wrote {MATRIX_DOC.relative_to(REPO)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

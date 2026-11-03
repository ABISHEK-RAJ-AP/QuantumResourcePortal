"""Render PHASE_1_GUIDE.md from the template, inlining repository files verbatim.

Usage (from the repository root):  python3 docs/guide-src/render.py
"""
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[2]
SRC = ROOT / "docs/guide-src/PHASE_1_GUIDE.tmpl.md"
OUT = ROOT / "docs/PHASE_1_GUIDE.md"
LANG = {".py": "python", ".ts": "ts", ".tsx": "tsx", ".css": "css", ".json": "json",
        ".html": "html", ".toml": "toml", ".ini": "ini", ".md": "markdown", ".svg": "xml",
        ".mako": "python", ".txt": "text", ".example": "bash", "": "text"}


def block(rel: str) -> str:
    path = ROOT / rel
    text = path.read_text(encoding="utf-8").rstrip("\n")
    lang = "makefile" if path.name == "Makefile" else LANG.get(path.suffix, "text")
    fence = "````" if "```" in text else "```"
    return f"\n{fence}{lang}\n{text}\n{fence}\n"


def inits() -> str:
    files = sorted((ROOT / "backend/qre").rglob("__init__.py"))
    return "\n".join(f"**`{f.relative_to(ROOT)}`**\n{block(str(f.relative_to(ROOT)))}" for f in files)


tmpl = SRC.read_text(encoding="utf-8")
missing = [m for m in re.findall(r"\{\{file:([^}]+)\}\}", tmpl) if not (ROOT / m).exists()]
if missing:
    raise SystemExit(f"Missing files referenced by the guide: {missing}")
out = re.sub(r"\{\{file:([^}]+)\}\}", lambda m: block(m.group(1)), tmpl)
out = out.replace("{{inits}}", inits())
OUT.write_text(out, encoding="utf-8")
print(f"wrote {OUT.relative_to(ROOT)} ({len(out.splitlines())} lines)")

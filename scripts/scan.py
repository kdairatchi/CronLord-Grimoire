#!/usr/bin/env python3
"""Scan every ritual for schema, safety, and convention violations.

Rules (FAIL):
  - TOML must parse, one [[jobs]] block required
  - All required fields present (id/name/description/category/kind/schedule/timezone/enabled)
  - `id` matches filename stem; `category` matches parent dir
  - `enabled` must be literal False (grimoire invariant)
  - Cron expression is 5 fields and each field validates
  - No hardcoded secrets (OpenAI/Slack/GitHub/AWS/Google token patterns)

Rules (WARN):
  - `timezone` not UTC outside personal/, home/
  - `timeout_sec` missing on shell rituals
  - Header comment < 2 lines
  - Destructive action (rm -rf, prune, DROP, --force) without DANGER note in header

Writes docs/scan.json for consumption by the gallery UI. Exits non-zero on any FAIL.
"""
from __future__ import annotations

import json
import re
import sys
import tomllib
from dataclasses import asdict, dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RITUALS = ROOT / "rituals"
JSON_OUT = ROOT / "docs" / "scan.json"

REQUIRED = ("id", "name", "description", "category", "kind", "schedule", "timezone", "enabled")
LOCAL_TZ_OK = {"personal", "home"}

PERMISSION_SIGNATURES = {
    "network":     [r"\bcurl\b", r"\bwget\b", r"\bssh\b", r"\bnc\b", r"https?://", r"api\.", r"webhook", r"\bdig\b"],
    "filesystem":  [r"\bmkdir\b", r"\btee\b", r"\btouch\b", r"\btar\b", r"\bzip\b", r">>?\s*\S"],
    "secrets":     [r"\$\{[A-Z][A-Z0-9_]*_(?:TOKEN|KEY|SECRET|PASS|PASSWORD|CREDENTIAL|AUTH)\b", r"\bPGPASSWORD\b", r"\bGITHUB_TOKEN\b"],
    "git":         [r"\bgit\s+(?:commit|push|add|tag|reset)\b"],
    "database":    [r"\bpg_dump\b", r"\bpsql\b", r"\bmysql\b", r"\bmysqldump\b", r"\bsqlite3?\b", r"\bredis-cli\b", r"\bmongodump\b"],
    "destructive": [r"\brm\s+-[rRf]", r"docker\s+system\s+prune", r"vacuum\s+full", r"\bDROP\s+TABLE\b", r"find\b.*-delete", r"--force\b"],
    "llm":         [r"\bclaude\b", r"\bollama\b", r"api\.openai", r"generativelanguage\.googleapis", r"api\.groq", r"api\.anthropic", r"openrouter"],
}

HARDCODED_SECRET_PATTERNS = [
    (r"\bsk-[a-zA-Z0-9]{20,}", "OpenAI-style API key"),
    (r"\bxox[abpsr]-[0-9A-Za-z-]{10,}", "Slack token"),
    (r"\bghp_[A-Za-z0-9]{20,}", "GitHub personal token"),
    (r"\bAKIA[0-9A-Z]{16}\b", "AWS access key id"),
    (r"\bAIza[0-9A-Za-z_-]{20,}", "Google API key"),
]

CRON_FIELD = re.compile(r"^(\*|\d+|\d+-\d+|\*/\d+|(?:\d+,)+\d+)(?:/\d+)?$")


@dataclass
class Audit:
    path: str
    id: str
    category: str
    trust: str = "core"
    author: str = "kdairatchi"
    required_env: list[str] = field(default_factory=list)
    permissions: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    @property
    def status(self) -> str:
        if self.errors:
            return "FAIL"
        if self.warnings:
            return "WARN"
        return "PASS"


def validate_cron(expr: str) -> bool:
    parts = expr.split()
    if len(parts) != 5:
        return False
    return all(CRON_FIELD.match(p) for p in parts)


def scan_file(path: Path) -> Audit:
    rel = path.relative_to(ROOT).as_posix()
    try:
        with path.open("rb") as fh:
            data = tomllib.load(fh)
    except tomllib.TOMLDecodeError as e:
        a = Audit(path=rel, id=path.stem, category=path.parent.name)
        a.errors.append(f"TOML parse error: {e}")
        return a

    jobs = data.get("jobs") or []
    if not jobs:
        a = Audit(path=rel, id=path.stem, category=path.parent.name)
        a.errors.append("no [[jobs]] block")
        return a
    if len(jobs) > 1:
        a = Audit(path=rel, id=path.stem, category=path.parent.name)
        a.errors.append(f"{len(jobs)} [[jobs]] blocks — grimoire rule is one per file")
        return a

    job = jobs[0]
    a = Audit(
        path=rel,
        id=job.get("id", path.stem),
        category=job.get("category") or path.parent.name,
        trust=job.get("trust", "core"),
        author=job.get("author", "kdairatchi"),
    )

    for f in REQUIRED:
        if f not in job:
            a.errors.append(f"missing required field: {f}")

    if "id" in job and job["id"] != path.stem:
        a.errors.append(f"id '{job['id']}' != filename stem '{path.stem}'")

    if "category" in job and job["category"] != path.parent.name:
        a.errors.append(f"category '{job['category']}' != parent dir '{path.parent.name}'")

    if job.get("enabled") is not False:
        a.errors.append(f"enabled must be false (got {job.get('enabled')!r})")

    sched = job.get("schedule")
    if sched and not validate_cron(sched):
        a.errors.append(f"invalid cron: '{sched}'")

    tz = job.get("timezone", "UTC")
    if tz != "UTC" and path.parent.name not in LOCAL_TZ_OK:
        a.warnings.append(f"non-UTC timezone '{tz}' outside personal/home")

    if job.get("kind", "shell") == "shell" and "timeout_sec" not in job:
        a.warnings.append("no timeout_sec — shell rituals should cap runtime")

    if a.trust not in ("core", "community", "experimental"):
        a.errors.append(f"invalid trust '{a.trust}' (must be core|community|experimental)")

    raw = path.read_text()
    header = []
    for line in raw.splitlines():
        if line.startswith("#"):
            header.append(line)
        elif line.strip() == "":
            continue
        else:
            break
    if len(header) < 2:
        a.warnings.append("header comment should be ≥2 lines (what + install hints)")

    cmd = job.get("command", "")
    if isinstance(cmd, list):
        cmd_str = " ".join(str(x) for x in cmd)
    else:
        cmd_str = str(cmd)

    for m in re.finditer(r"\$\{([A-Z][A-Z0-9_]*):\?required\}", cmd_str):
        v = m.group(1)
        if v not in a.required_env:
            a.required_env.append(v)

    for perm, patterns in PERMISSION_SIGNATURES.items():
        if any(re.search(p, cmd_str) for p in patterns):
            a.permissions.append(perm)

    for pat, label in HARDCODED_SECRET_PATTERNS:
        if re.search(pat, cmd_str):
            a.errors.append(f"possible hardcoded {label} in command body")

    if "destructive" in a.permissions:
        header_text = "\n".join(header).upper()
        if "DANGER" not in header_text:
            a.warnings.append("destructive action lacks DANGER note in header")

    return a


def main() -> int:
    if not RITUALS.is_dir():
        print(f"no rituals dir at {RITUALS}", file=sys.stderr)
        return 1

    audits = [scan_file(p) for p in sorted(RITUALS.rglob("*.toml"))]
    pass_n = sum(1 for a in audits if a.status == "PASS")
    warn_n = sum(1 for a in audits if a.status == "WARN")
    fail_n = sum(1 for a in audits if a.status == "FAIL")

    print(f"\nscanned {len(audits)} rituals\n")
    for a in audits:
        mark = {"PASS": "✓", "WARN": "!", "FAIL": "✗"}[a.status]
        print(f"  {mark} [{a.status}] {a.path}")
        for e in a.errors:
            print(f"      ERROR: {e}")
        for w in a.warnings:
            print(f"      warn:  {w}")
        if a.permissions:
            print(f"      perms: {', '.join(a.permissions)}")
        if a.required_env:
            print(f"      env:   {', '.join(a.required_env)}")

    print(f"\n  pass: {pass_n}  warn: {warn_n}  fail: {fail_n}\n")

    JSON_OUT.parent.mkdir(parents=True, exist_ok=True)
    JSON_OUT.write_text(
        json.dumps(
            {
                "total": len(audits),
                "pass": pass_n,
                "warn": warn_n,
                "fail": fail_n,
                "results": [asdict(a) | {"status": a.status} for a in audits],
            },
            indent=2,
        )
        + "\n"
    )
    print(f"  wrote {JSON_OUT.relative_to(ROOT)}")
    return 1 if fail_n else 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""Verify inactive playback route error taxonomy parity remains shadow-only."""

from __future__ import annotations

import json
import re
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parents[2]
TOOL_DIR = ROOT / "tools" / "playback-parity-v1"
BASE_BRANCH = "haskell-playback-inactive-route-fixture-coverage-20260613-003827"
HS_PATH = TOOL_DIR / "InactivePlaybackRouteErrorTaxonomy.hs"
JS_PATH = TOOL_DIR / "inactive_playback_route_error_taxonomy_shadow_js.js"
FIXTURE_PATH = TOOL_DIR / "inactive-playback-route-error-taxonomy-fixtures.json"
PACKAGE_PATH = ROOT / "package.json"
PACKAGE_LOCK_PATH = ROOT / "package-lock.json"

ALLOWED_NEW_NPM_SCRIPTS = {
    "test:playback-inactive-route-error-taxonomy": (
        "python3 tools/playback-parity-v1/inactive_playback_route_error_taxonomy_js_vs_hs_compare.py --write-report "
        "&& python3 tools/playback-parity-v1/inactive_playback_route_error_taxonomy_envelope_gate.py --write-report "
        "&& python3 tools/playback-parity-v1/inactive_playback_route_error_taxonomy_fixture_coverage_audit.py --write-report "
        "&& python3 tools/playback-parity-v1/inactive_playback_route_error_taxonomy_safety_gate.py --write-report"
    )
}

FORBIDDEN_PATH_PREFIXES = (
    "public/",
    "routes/",
    "middleware/",
    "src/",
    "lib/",
)
FORBIDDEN_EXACT_PATHS = {
    "server.js",
    "public/app.js",
    "public/player.js",
}
ACTIVE_RUNTIME_PREFIXES = (
    "server.js",
    "app/",
    "lib/",
    "middleware/",
    "public/",
    "routes/",
    "src/",
)
ACTIVE_ROUTE_RE = re.compile(
    r"\b(?:app|router)\s*\.\s*(?:get|post|put|patch|delete|all|use)\s*\(",
    re.IGNORECASE,
)
SERVER_START_RE = re.compile(
    r"\b(?:npm\s+(?:run\s+)?start|node\s+server\.js|app\.listen\s*\(|server\.listen\s*\()",
    re.IGNORECASE,
)
FFMPEG_COMMAND_RE = re.compile(
    r"\b(?:spawn|exec|execFile|subprocess\.[A-Za-z_]+|createProcess)\s*\([^)\n]*(?:ffmpeg|avconv)",
    re.IGNORECASE,
)
LIVE_OR_FTP_CALL_RE = re.compile(
    r"\b(?:fetch|axios|request|http\.get|https\.get|ftp\.access|client\.access|curl|wget)\s*\([^)\n]*"
    r"(?:ftp://|ftps://|https?://|/live/|localhost|127\.0\.0\.1)",
    re.IGNORECASE,
)
WORKFLOW_WRITE_RE = re.compile(r"(?m)^\s*(?:contents|pull-requests|issues|actions|checks):\s*write\s*$")


def report_path() -> Path:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    return TOOL_DIR / f"inactive-playback-route-error-taxonomy-safety-report-{stamp}.txt"


def run_git(args: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", *args],
        cwd=ROOT,
        check=False,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )


def base_ref() -> str:
    for candidate in [f"origin/{BASE_BRANCH}", BASE_BRANCH]:
        if run_git(["rev-parse", "--verify", "--quiet", candidate]).returncode == 0:
            result = run_git(["merge-base", candidate, "HEAD"])
            if result.returncode == 0 and result.stdout.strip():
                return result.stdout.strip()
            return candidate
    return "HEAD~1"


def changed_files(base: str) -> list[str]:
    result = run_git(["diff", "--name-only", f"{base}...HEAD"])
    if result.returncode != 0:
        return []
    files = [line.strip() for line in result.stdout.splitlines() if line.strip()]
    status = run_git(["status", "--short"])
    for line in status.stdout.splitlines():
        if line.startswith("?? "):
            files.append(line[3:].strip())
    return sorted(set(files))


def added_lines(base: str) -> list[tuple[str, str]]:
    result = run_git(["diff", "--unified=0", f"{base}...HEAD"])
    if result.returncode != 0:
        return []
    current_file = ""
    lines: list[tuple[str, str]] = []
    for line in result.stdout.splitlines():
        if line.startswith("+++ b/"):
            current_file = line.removeprefix("+++ b/")
            continue
        if line.startswith("+") and not line.startswith("+++"):
            lines.append((current_file, line[1:]))
    return lines


def tracked_files() -> list[str]:
    result = run_git(["ls-files"])
    if result.returncode != 0:
        return []
    return [line.strip() for line in result.stdout.splitlines() if line.strip()]


def file_at(ref_name: str, path: str) -> str | None:
    result = run_git(["show", f"{ref_name}:{path}"])
    if result.returncode != 0:
        return None
    return result.stdout


def read_json(text: str | None, path: Path) -> tuple[dict[str, Any] | None, str | None]:
    try:
        parsed = json.loads(path.read_text(encoding="utf-8") if text is None else text)
    except (OSError, json.JSONDecodeError) as exc:
        return None, str(exc)
    if not isinstance(parsed, dict):
        return None, "expected top-level object"
    return parsed, None


def active_runtime_files() -> list[str]:
    files: list[str] = []
    for path in tracked_files():
        if path.startswith("node_modules/") or path.startswith("tools/"):
            continue
        if path.endswith((".js", ".ts", ".jsx", ".tsx", ".hs", ".cabal")):
            if path == "server.js" or path.startswith(ACTIVE_RUNTIME_PREFIXES):
                files.append(path)
    return files


def active_reference_failures() -> list[str]:
    failures: list[str] = []
    needles = [
        "InactivePlaybackRouteErrorTaxonomy",
        "inactive_playback_route_error_taxonomy",
        "inactive-playback-route-error-taxonomy",
        "error-taxonomy",
        "error_taxonomy",
    ]
    for path in active_runtime_files():
        full_path = ROOT / path
        try:
            text = full_path.read_text(encoding="utf-8", errors="ignore")
        except OSError as exc:
            failures.append(f"could not read {path}: {exc}")
            continue
        for needle in needles:
            if needle in text:
                failures.append(f"active runtime references error taxonomy shadow {needle}: {path}")
    return failures


def package_failures(base: str) -> list[str]:
    failures: list[str] = []
    base_pkg, base_err = read_json(file_at(base, "package.json"), PACKAGE_PATH)
    head_pkg, head_err = read_json(None, PACKAGE_PATH)
    if base_err or head_err or base_pkg is None or head_pkg is None:
        return [f"package.json could not be parsed: base={base_err}, head={head_err}"]

    for key in ("version", "dependencies", "devDependencies", "optionalDependencies", "peerDependencies"):
        if base_pkg.get(key) != head_pkg.get(key):
            failures.append(f"package.json {key} changed")

    base_scripts = dict(base_pkg.get("scripts", {}))
    head_scripts = dict(head_pkg.get("scripts", {}))
    expected_scripts = dict(base_scripts)
    for script_name, script_value in ALLOWED_NEW_NPM_SCRIPTS.items():
        if script_name in head_scripts:
            expected_scripts[script_name] = script_value
    if head_scripts != expected_scripts:
        failures.append("package.json scripts changed beyond inactive error taxonomy npm script")

    if PACKAGE_LOCK_PATH.exists():
        lock_diff = run_git(["diff", "--name-only", f"{base}...HEAD", "--", "package-lock.json"])
        if lock_diff.returncode == 0 and lock_diff.stdout.strip():
            failures.append("package-lock.json changed")
    return failures


def diff_safety_failures(base: str, files: list[str]) -> list[str]:
    failures: list[str] = []
    forbidden_changes = [
        path
        for path in files
        if path in FORBIDDEN_EXACT_PATHS or path.startswith(FORBIDDEN_PATH_PREFIXES)
    ]
    if forbidden_changes:
        failures.append(f"forbidden active runtime/frontend files changed: {forbidden_changes}")

    for path, line in added_lines(base):
        if not path:
            continue
        if path.endswith((".md", ".txt", ".json")):
            continue
        if path == "package.json" and any(script_name in line for script_name in ALLOWED_NEW_NPM_SCRIPTS):
            continue

        if SERVER_START_RE.search(line):
            failures.append(f"server startup command added in {path}: {line.strip()}")
        if FFMPEG_COMMAND_RE.search(line):
            failures.append(f"FFmpeg command added in {path}: {line.strip()}")
        if LIVE_OR_FTP_CALL_RE.search(line):
            failures.append(f"FTP/live/local URL call added in {path}: {line.strip()}")
        if path == "server.js" or path.startswith(("app/", "routes/", "src/", "lib/", "middleware/")):
            if ACTIVE_ROUTE_RE.search(line):
                failures.append(f"active HTTP route code added in {path}: {line.strip()}")
        if WORKFLOW_WRITE_RE.search(line):
            failures.append(f"workflow write permission added in {path}: {line.strip()}")
    return failures


def fixture_failures() -> list[str]:
    failures: list[str] = []
    try:
        fixtures = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        return [f"fixtures could not be parsed: {exc}"]
    if not isinstance(fixtures, list):
        return ["fixtures must be a JSON array"]

    for fixture in fixtures:
        if not isinstance(fixture, dict):
            failures.append("fixture contains non-object entry")
            continue
        fixture_id = str(fixture.get("fixtureId") or "unknown")
        stream_url = str(fixture.get("streamUrl") or "")
        reason = str(fixture.get("expectedReasonCode") or "")
        if "localhost" in stream_url or "127.0.0.1" in stream_url:
            failures.append(f"{fixture_id}: localhost fixture URL is forbidden")
        if stream_url.startswith("placeholder://"):
            if reason != "UNSAFE_PLACEHOLDER_URL":
                failures.append(f"{fixture_id}: placeholder URL must be an unsafe placeholder fixture")
            continue
        if stream_url.startswith("local://") or stream_url == "":
            continue
        parsed = urlparse(stream_url)
        if parsed.scheme in {"http", "https", "ftp"}:
            if not (parsed.hostname or "").endswith(".example.test"):
                failures.append(f"{fixture_id}: non-placeholder URL host must end with .example.test")
        else:
            failures.append(f"{fixture_id}: unsupported fixture URL scheme: {stream_url}")
    return failures


def shadow_file_failures() -> list[str]:
    failures: list[str] = []
    required = [HS_PATH, JS_PATH, FIXTURE_PATH]
    for path in required:
        if not path.exists():
            failures.append(f"missing required file: {path.relative_to(ROOT)}")
    if HS_PATH.exists():
        text = HS_PATH.read_text(encoding="utf-8", errors="ignore")
        if "INACTIVE SHADOW-ONLY ROUTE ERROR TAXONOMY" not in text:
            failures.append("Haskell error taxonomy shadow banner missing")
    if JS_PATH.exists():
        text = JS_PATH.read_text(encoding="utf-8", errors="ignore")
        for forbidden in ["listen(", "fetch(", "spawn(", "exec(", "execFile("]:
            if forbidden in text:
                failures.append(f"JS error taxonomy shadow contains forbidden token: {forbidden}")
    return failures


def main() -> int:
    write_report = "--write-report" in sys.argv
    base = base_ref()
    files = changed_files(base)
    failures: list[str] = []
    failures.extend(diff_safety_failures(base, files))
    failures.extend(active_reference_failures())
    failures.extend(package_failures(base))
    failures.extend(fixture_failures())
    failures.extend(shadow_file_failures())

    ok = not failures
    lines = [
        f"Status: {'PASS' if ok else 'FAIL'}",
        "mode: read-only inactive playback route error taxonomy safety gate",
        "server_started: no",
        "network_called: no",
        "ffmpeg_started: no",
        "runtime_playback_changed: no",
        "active_routes_added: no",
        "inactive_route_wired: no",
        "frontend_playback_changed: no",
        "localhost_url_activated: no",
        f"base_ref: {base}",
        f"changed_files: {files}",
        f"allowed_new_npm_scripts: {sorted(ALLOWED_NEW_NPM_SCRIPTS)}",
        f"active_runtime_scan_count: {len(active_runtime_files())}",
        f"failures: {failures}",
    ]
    output = "\n".join(lines) + "\n"
    if write_report:
        path = report_path()
        path.write_text(output, encoding="utf-8")
        sys.stdout.write(f"report_path: {path.relative_to(ROOT)}\n")
    sys.stdout.write(output)
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())

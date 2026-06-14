#!/usr/bin/env python3
"""Verify inactive playback route implementation shadow remains unwired."""

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
FIXTURE_PATH = TOOL_DIR / "inactive-playback-route-implementation-shadow-fixtures.json"
CONTRACT_MD_PATH = TOOL_DIR / "inactive-playback-route-implementation-shadow-contract.md"
CONTRACT_JSON_PATH = TOOL_DIR / "inactive-playback-route-implementation-shadow-contract.json"
HS_PATH = TOOL_DIR / "InactivePlaybackRouteImplementationShadow.hs"
JS_PATH = TOOL_DIR / "inactive_playback_route_implementation_shadow_js.js"
COMPARE_PATH = TOOL_DIR / "inactive_playback_route_implementation_shadow_js_vs_hs_compare.py"
ENVELOPE_PATH = TOOL_DIR / "inactive_playback_route_implementation_shadow_envelope_gate.py"
COVERAGE_PATH = TOOL_DIR / "inactive_playback_route_implementation_shadow_fixture_coverage_audit.py"
SAFETY_PATH = TOOL_DIR / "inactive_playback_route_implementation_shadow_safety_gate.py"
REPORT_SCRIPT_PATH = TOOL_DIR / "inactive_playback_route_implementation_shadow_report.py"
PACKAGE_PATH = ROOT / "package.json"
PACKAGE_LOCK_PATH = ROOT / "package-lock.json"

IMPLEMENTATION_NPM_SCRIPT = {
    "test:playback-inactive-route-implementation-shadow": (
        "python3 tools/playback-parity-v1/inactive_playback_route_implementation_shadow_js_vs_hs_compare.py --write-report "
        "&& python3 tools/playback-parity-v1/inactive_playback_route_implementation_shadow_envelope_gate.py --write-report "
        "&& python3 tools/playback-parity-v1/inactive_playback_route_implementation_shadow_fixture_coverage_audit.py --write-report "
        "&& python3 tools/playback-parity-v1/inactive_playback_route_implementation_shadow_safety_gate.py --write-report "
        "&& python3 tools/playback-parity-v1/inactive_playback_route_implementation_shadow_report.py --write-report"
    ),
    "test:playback-inactive-route-activation-plan": (
        "python3 tools/playback-parity-v1/inactive_playback_route_activation_plan_prerequisites.py --write-report "
        "&& python3 tools/playback-parity-v1/inactive_playback_route_activation_plan_dependency_checker.py --write-report "
        "&& python3 tools/playback-parity-v1/inactive_playback_route_activation_plan_safety_gate.py --write-report "
        "&& python3 tools/playback-parity-v1/inactive_playback_route_activation_plan_report.py --write-report"
    ),
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
ALLOWED_CHANGED_PREFIXES = ("tools/playback-parity-v1/",)
ALLOWED_CHANGED_FILES = {"package.json", "package-lock.json"}
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
    return TOOL_DIR / f"inactive-playback-route-implementation-shadow-safety-report-{stamp}.txt"


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
    files = [line.strip() for line in result.stdout.splitlines() if line.strip()] if result.returncode == 0 else []
    status = run_git(["status", "--short"])
    for line in status.stdout.splitlines():
        if line.startswith("?? "):
            files.append(line[3:].strip())
        elif len(line) > 3 and line[2] == " ":
            files.append(line[3:].strip())
        elif len(line) > 2 and line[1] == " ":
            files.append(line[2:].strip())
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


def read_json(text: str | None, path: Path) -> tuple[Any | None, str | None]:
    try:
        parsed = json.loads(path.read_text(encoding="utf-8") if text is None else text)
    except (OSError, json.JSONDecodeError) as exc:
        return None, str(exc)
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
        "InactivePlaybackRouteImplementationShadow",
        "inactive_playback_route_implementation_shadow",
        "inactive-playback-route-implementation-shadow",
        "implementation-shadow",
        "implementation_shadow",
        "playback-route-shadow",
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
                failures.append(f"active runtime references implementation shadow {needle}: {path}")
    return failures


def package_failures(base: str) -> list[str]:
    failures: list[str] = []
    base_pkg, base_err = read_json(file_at(base, "package.json"), PACKAGE_PATH)
    head_pkg, head_err = read_json(None, PACKAGE_PATH)
    if base_err or head_err or not isinstance(base_pkg, dict) or not isinstance(head_pkg, dict):
        return [f"package.json could not be parsed: base={base_err}, head={head_err}"]

    for key in ("version", "dependencies", "devDependencies", "optionalDependencies", "peerDependencies"):
        if base_pkg.get(key) != head_pkg.get(key):
            failures.append(f"package.json {key} changed")

    base_scripts = dict(base_pkg.get("scripts", {}))
    head_scripts = dict(head_pkg.get("scripts", {}))
    expected_scripts = dict(base_scripts)
    for script_name, script_value in IMPLEMENTATION_NPM_SCRIPT.items():
        if script_name in head_scripts:
            expected_scripts[script_name] = script_value
    if head_scripts != expected_scripts:
        failures.append("package.json scripts changed beyond inactive implementation shadow npm script")

    if PACKAGE_LOCK_PATH.exists():
        lock_diff = run_git(["diff", "--name-only", f"{base}...HEAD", "--", "package-lock.json"])
        if lock_diff.returncode == 0 and lock_diff.stdout.strip():
            failures.append("package-lock.json changed")
    return failures


def changed_path_failures(files: list[str]) -> list[str]:
    failures: list[str] = []
    for path in files:
        if path in ALLOWED_CHANGED_FILES or path.startswith(ALLOWED_CHANGED_PREFIXES):
            continue
        failures.append(f"changed file outside implementation shadow allowed scope: {path}")
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
        if path == "package.json" and any(script_name in line for script_name in IMPLEMENTATION_NPM_SCRIPT):
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


def fixture_safety_failures() -> list[str]:
    failures: list[str] = []
    fixtures, err = read_json(None, FIXTURE_PATH)
    if err or not isinstance(fixtures, list):
        return [f"implementation fixtures could not be parsed: {err or 'expected array'}"]
    for fixture in fixtures:
        if not isinstance(fixture, dict):
            failures.append("fixture entry must be an object")
            continue
        fixture_id = str(fixture.get("fixtureId") or "unknown")
        stream_url = str(fixture.get("streamUrl") or "")
        marker = json.dumps(fixture, sort_keys=True).lower()
        if "localhost" in stream_url or "127.0.0.1" in stream_url:
            failures.append(f"{fixture_id}: localhost or loopback URL is forbidden")
            continue
        parsed = urlparse(stream_url)
        if parsed.scheme == "local":
            continue
        if parsed.scheme == "placeholder":
            if "unsafe" not in marker:
                failures.append(f"{fixture_id}: placeholder URL must be explicit unsafe coverage")
            continue
        if parsed.scheme in {"http", "https", "ftp"}:
            if not (parsed.hostname or "").endswith(".example.test"):
                failures.append(f"{fixture_id}: URL host must end with .example.test")
            continue
        failures.append(f"{fixture_id}: unsupported fixture URL scheme: {stream_url}")
    return failures


def shadow_file_failures() -> list[str]:
    failures: list[str] = []
    required = [
        FIXTURE_PATH,
        CONTRACT_MD_PATH,
        CONTRACT_JSON_PATH,
        HS_PATH,
        JS_PATH,
        COMPARE_PATH,
        ENVELOPE_PATH,
        COVERAGE_PATH,
        SAFETY_PATH,
        REPORT_SCRIPT_PATH,
    ]
    for path in required:
        if not path.exists():
            failures.append(f"missing required file: {path.relative_to(ROOT)}")
    if HS_PATH.exists():
        text = HS_PATH.read_text(encoding="utf-8", errors="ignore")
        if "INACTIVE SHADOW-ONLY ROUTE IMPLEMENTATION" not in text:
            failures.append("Haskell implementation shadow banner missing")
    if JS_PATH.exists():
        text = JS_PATH.read_text(encoding="utf-8", errors="ignore")
        for forbidden in ["listen(", "fetch(", "spawn(", "exec(", "execFile("]:
            if forbidden in text:
                failures.append(f"JS implementation shadow contains forbidden token: {forbidden}")
    return failures


def main() -> int:
    write_report = "--write-report" in sys.argv
    base = base_ref()
    files = changed_files(base)
    failures: list[str] = []
    failures.extend(changed_path_failures(files))
    failures.extend(diff_safety_failures(base, files))
    failures.extend(active_reference_failures())
    failures.extend(package_failures(base))
    failures.extend(fixture_safety_failures())
    failures.extend(shadow_file_failures())

    ok = not failures
    lines = [
        f"Status: {'PASS' if ok else 'FAIL'}",
        "mode: read-only inactive playback route implementation shadow safety gate",
        "server_started: no",
        "network_called: no",
        "ffmpeg_started: no",
        "runtime_playback_changed: no",
        "active_routes_added: no",
        "inactive_route_wired: no",
        "frontend_playback_changed: no",
        "live_url_activated: no",
        "all_fixtures_safe: yes" if ok else "all_fixtures_safe: no",
        f"base_ref: {base}",
        f"changed_files: {files}",
        f"allowed_new_npm_scripts: {sorted(IMPLEMENTATION_NPM_SCRIPT)}",
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

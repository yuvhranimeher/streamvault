#!/usr/bin/env python3
"""Verify inactive playback route adapter tests remain shadow-only and read-only."""

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
HS_ADAPTER_PATH = TOOL_DIR / "InactivePlaybackRouteAdapter.hs"
JS_ADAPTER_PATH = TOOL_DIR / "inactive_playback_route_adapter_shadow_js.js"
FIXTURE_PATH = TOOL_DIR / "inactive-playback-route-adapter-fixtures.json"
PACKAGE_PATH = ROOT / "package.json"
PACKAGE_LOCK_PATH = ROOT / "package-lock.json"

ADAPTER_NPM_SCRIPT = {
    "test:playback-inactive-route-adapter": (
        "python3 tools/playback-parity-v1/inactive_playback_route_adapter_js_vs_hs_compare.py --write-report "
        "&& python3 tools/playback-parity-v1/inactive_playback_route_adapter_safety_gate.py --write-report"
    ),
    "test:playback-inactive-route-response-body": (
        "python3 tools/playback-parity-v1/inactive_playback_route_response_body_js_vs_hs_compare.py --write-report "
        "&& python3 tools/playback-parity-v1/inactive_playback_route_response_body_envelope_gate.py --write-report "
        "&& python3 tools/playback-parity-v1/inactive_playback_route_response_body_fixture_coverage_audit.py --write-report "
        "&& python3 tools/playback-parity-v1/inactive_playback_route_response_body_safety_gate.py --write-report"
    ),
    "test:playback-inactive-route-status-headers": (
        "python3 tools/playback-parity-v1/inactive_playback_route_status_header_js_vs_hs_compare.py --write-report "
        "&& python3 tools/playback-parity-v1/inactive_playback_route_status_header_envelope_gate.py --write-report "
        "&& python3 tools/playback-parity-v1/inactive_playback_route_status_header_fixture_coverage_audit.py --write-report "
        "&& python3 tools/playback-parity-v1/inactive_playback_route_status_header_safety_gate.py --write-report"
    ),
    "test:playback-inactive-route-error-taxonomy": (
        "python3 tools/playback-parity-v1/inactive_playback_route_error_taxonomy_js_vs_hs_compare.py --write-report "
        "&& python3 tools/playback-parity-v1/inactive_playback_route_error_taxonomy_envelope_gate.py --write-report "
        "&& python3 tools/playback-parity-v1/inactive_playback_route_error_taxonomy_fixture_coverage_audit.py --write-report "
        "&& python3 tools/playback-parity-v1/inactive_playback_route_error_taxonomy_safety_gate.py --write-report"
    ),
    "test:playback-inactive-route-final-readiness": (
        "python3 tools/playback-parity-v1/inactive_playback_route_final_readiness_js_vs_hs_compare.py --write-report "
        "&& python3 tools/playback-parity-v1/inactive_playback_route_final_readiness_safety_gate.py --write-report "
        "&& python3 tools/playback-parity-v1/inactive_playback_route_final_readiness_report.py --write-report"
    ),
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

FRONTEND_PLAYBACK_FILES = {
    "public/app.js",
    "public/player.js",
    "public/details.js",
    "public/livetv.js",
    "public/movies-page-fix.js",
    "public/series-page-fix.js",
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
    r"\b(?:app|router)\s*\.\s*(?:get|post|put|patch|delete|all|use)\s*\("
    r"\s*[`'\"]/(?:api/playback/(?:local|ftp|movie)|api/ftp/raw|api/playback/series|api/playback/live|live/)",
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
    r"(?:ftp://|ftps://|https?://|/live/)",
    re.IGNORECASE,
)
WORKFLOW_WRITE_RE = re.compile(r"(?m)^\s*(?:contents|pull-requests|issues|actions|checks):\s*write\s*$")


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def report_path() -> Path:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    return TOOL_DIR / f"inactive-playback-route-adapter-safety-report-{stamp}.txt"


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


def adapter_reference_failures() -> list[str]:
    failures: list[str] = []
    needles = [
        "InactivePlaybackRouteAdapter",
        "inactive_playback_route_adapter_shadow_js",
        "inactive_playback_route_adapter_js_vs_hs_compare",
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
                failures.append(f"active runtime references inactive adapter {needle}: {path}")
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
    for script_name, script_value in ADAPTER_NPM_SCRIPT.items():
        if script_name in head_scripts:
            expected_scripts[script_name] = script_value
    if head_scripts != expected_scripts:
        failures.append("package.json scripts changed beyond inactive adapter npm script")

    if PACKAGE_LOCK_PATH.exists():
        lock_diff = run_git(["diff", "--name-only", f"{base}...HEAD", "--", "package-lock.json"])
        if lock_diff.returncode == 0 and lock_diff.stdout.strip():
            failures.append("package-lock.json changed")
    return failures


def diff_safety_failures(base: str, files: list[str]) -> list[str]:
    failures: list[str] = []
    frontend_changes = sorted(path for path in files if path in FRONTEND_PLAYBACK_FILES)
    if frontend_changes:
        failures.append(f"frontend playback files changed: {frontend_changes}")

    for path, line in added_lines(base):
        if not path:
            continue
        if path.endswith((".md", ".txt", ".json")):
            continue
        if path == "package.json" and any(script_name in line for script_name in ADAPTER_NPM_SCRIPT):
            continue

        if SERVER_START_RE.search(line):
            failures.append(f"server startup command added in {path}: {line.strip()}")
        if FFMPEG_COMMAND_RE.search(line):
            failures.append(f"FFmpeg command added in {path}: {line.strip()}")
        if LIVE_OR_FTP_CALL_RE.search(line):
            failures.append(f"FTP/live URL call added in {path}: {line.strip()}")
        if path == "server.js" or path.startswith(("app/", "routes/", "src/", "lib/")):
            if ACTIVE_ROUTE_RE.search(line):
                failures.append(f"active playback HTTP route added in {path}: {line.strip()}")

    for path in [path for path in files if path.startswith(".github/workflows/")]:
        text = (ROOT / path).read_text(encoding="utf-8", errors="ignore")
        if WORKFLOW_WRITE_RE.search(text):
            failures.append(f"workflow permissions are not read-only in {path}")
        for forbidden in [
            "secrets.",
            "gh pr comment",
            "gh issue comment",
            "npm " + "start",
            "npm run " + "start",
            "node " + "server.js",
        ]:
            if forbidden in text.lower():
                failures.append(f"workflow forbidden token found in {path}: {forbidden}")
    return failures


def adapter_file_failures() -> list[str]:
    failures: list[str] = []
    for path in [HS_ADAPTER_PATH, JS_ADAPTER_PATH, FIXTURE_PATH]:
        if not path.exists():
            failures.append(f"missing adapter file: {rel(path)}")

    for path in [HS_ADAPTER_PATH, JS_ADAPTER_PATH]:
        if not path.exists():
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")
        for label, pattern in [
            ("server startup", SERVER_START_RE),
            ("FFmpeg command", FFMPEG_COMMAND_RE),
            ("FTP/live URL call", LIVE_OR_FTP_CALL_RE),
            ("active route registration", ACTIVE_ROUTE_RE),
        ]:
            if pattern.search(text):
                failures.append(f"{label} found in adapter file: {rel(path)}")
    return failures


def safe_fixture_url(value: str) -> bool:
    if not value:
        return True
    if value.startswith("local://"):
        return True
    if value.startswith("placeholder://"):
        return True
    parsed = urlparse(value)
    if parsed.scheme in {"http", "https", "ftp"}:
        return (parsed.hostname or "").endswith(".example.test")
    if parsed.scheme:
        return False
    return True


def walk_values(value: Any) -> list[str]:
    if isinstance(value, dict):
        values: list[str] = []
        for nested in value.values():
            values.extend(walk_values(nested))
        return values
    if isinstance(value, list):
        values: list[str] = []
        for nested in value:
            values.extend(walk_values(nested))
        return values
    if isinstance(value, str):
        return [value]
    return []


def fixture_failures() -> list[str]:
    failures: list[str] = []
    if not FIXTURE_PATH.exists():
        return [f"missing adapter fixture file: {rel(FIXTURE_PATH)}"]
    try:
        fixtures = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        return [f"adapter fixture JSON parse failed: {exc}"]
    if not isinstance(fixtures, list):
        return ["adapter fixture file must contain a JSON array"]
    required_names = {
        "adapter_get_movie_playback_query",
        "adapter_post_movie_playback_body",
        "adapter_local_playback_query",
        "adapter_ftp_playback_query",
        "adapter_ftp_raw_range_query",
        "adapter_series_episode_playback",
        "adapter_live_tv_hls_contract",
        "adapter_invalid_missing_route",
        "adapter_invalid_missing_streamUrl",
        "adapter_invalid_unsupported_method",
        "adapter_invalid_unsafe_streamUrl",
    }
    names = {str(item.get("name") or "") for item in fixtures if isinstance(item, dict)}
    missing = sorted(required_names - names)
    if missing:
        failures.append(f"adapter fixtures missing required cases: {missing}")
    for item in fixtures:
        if not isinstance(item, dict):
            failures.append("adapter fixture contains non-object entry")
            continue
        for value in walk_values(item):
            if "://" in value and not safe_fixture_url(value):
                failures.append(f"{item.get('name')}: unsafe fixture URL: {value}")
    return failures


def main() -> int:
    write_report = "--write-report" in sys.argv
    base = base_ref()
    files = changed_files(base)
    failures: list[str] = []

    failures.extend(adapter_reference_failures())
    failures.extend(package_failures(base))
    failures.extend(diff_safety_failures(base, files))
    failures.extend(adapter_file_failures())
    failures.extend(fixture_failures())

    ok = not failures
    lines = [
        f"Status: {'PASS' if ok else 'FAIL'}",
        "mode: inactive playback route adapter safety gate",
        f"base_branch: {BASE_BRANCH}",
        f"base_ref: {base}",
        "server_started: no",
        "network_called: no",
        "ffmpeg_started: no",
        "runtime_playback_changed: no",
        "active_routes_added: no",
        "inactive_route_wired: no",
        f"haskell_adapter_exists: {str(HS_ADAPTER_PATH.exists()).lower()}",
        f"js_adapter_exists: {str(JS_ADAPTER_PATH.exists()).lower()}",
        f"adapter_fixtures_exist: {str(FIXTURE_PATH.exists()).lower()}",
        f"changed_files: {files}",
        f"active_runtime_file_count_scanned: {len(active_runtime_files())}",
        f"allowed_npm_scripts: {sorted(ADAPTER_NPM_SCRIPT)}",
        f"failures: {failures}",
    ]
    output = "\n".join(lines) + "\n"
    if write_report:
        path = report_path()
        path.write_text(output, encoding="utf-8")
        sys.stdout.write(f"report_path: {rel(path)}\n")
    sys.stdout.write(output)
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())

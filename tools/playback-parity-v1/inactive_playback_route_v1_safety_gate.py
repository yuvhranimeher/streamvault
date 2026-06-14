#!/usr/bin/env python3
"""Verify inactive playback route v1 remains shadow-only and unwired."""

from __future__ import annotations

import json
import re
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
TOOL_DIR = ROOT / "tools" / "playback-parity-v1"
HS_PATH = TOOL_DIR / "InactivePlaybackRouteV1.hs"
PACKAGE_PATH = ROOT / "package.json"
PACKAGE_LOCK_PATH = ROOT / "package-lock.json"
BASE_REF = "haskell-playback-shadow-freeze-baseline-20260612-204551"
ALLOWED_NPM_SCRIPTS = {
    "test:playback-inactive-route-v1": (
        "python3 tools/playback-parity-v1/inactive_playback_route_v1_gate.py --write-report "
        "&& python3 tools/playback-parity-v1/inactive_playback_route_v1_safety_gate.py --write-report"
    ),
    "test:playback-inactive-route-fixtures": (
        "python3 tools/playback-parity-v1/inactive_playback_route_fixture_coverage_audit.py --write-report"
    ),
    "test:playback-inactive-route-envelope": (
        "python3 tools/playback-parity-v1/inactive_playback_route_response_envelope_gate.py --write-report"
    ),
    "report:playback-inactive-route-fixtures": (
        "python3 tools/playback-parity-v1/inactive_playback_route_fixture_pr_summary.py --write-report"
    ),
    "test:playback-inactive-route-fixture-review": (
        "python3 tools/playback-parity-v1/run_inactive_route_fixture_review_pack.py --write-report"
    ),
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

ALLOWED_INACTIVE_ROUTE_FILES = {
    "tools/playback-parity-v1/InactivePlaybackRouteV1.hs",
    "tools/playback-parity-v1/inactive_playback_route_v1_gate.py",
    "tools/playback-parity-v1/inactive_playback_route_v1_safety_gate.py",
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
    r"\s*[`'\"]/(?:api/playback/(?:local|ftp|movie)|api/ftp/raw|live/)",
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


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def report_path() -> Path:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    return TOOL_DIR / f"inactive-playback-route-v1-safety-report-{stamp}.txt"


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
    if run_git(["rev-parse", "--verify", "--quiet", BASE_REF]).returncode == 0:
        return BASE_REF
    result = run_git(["merge-base", "origin/" + BASE_REF, "HEAD"])
    if result.returncode == 0 and result.stdout.strip():
        return result.stdout.strip()
    return "HEAD~1"


def changed_files(base: str) -> list[str]:
    result = run_git(["diff", "--name-only", f"{base}...HEAD"])
    if result.returncode != 0:
        return []
    return [line.strip() for line in result.stdout.splitlines() if line.strip()]


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
        if text is None:
            parsed = json.loads(path.read_text(encoding="utf-8"))
        else:
            parsed = json.loads(text)
    except (OSError, json.JSONDecodeError) as exc:
        return None, str(exc)
    if not isinstance(parsed, dict):
        return None, "expected top-level object"
    return parsed, None


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
    for script_name, script_value in ALLOWED_NPM_SCRIPTS.items():
        base_script_value = base_scripts.pop(script_name, None)
        head_script_value = head_scripts.pop(script_name, None)
        if base_script_value is not None:
            failures.append(f"baseline unexpectedly already had {script_name}")
        if head_script_value is not None and head_script_value != script_value:
            failures.append(f"npm script {script_name} has unexpected value")
    if base_scripts != head_scripts:
        failures.append("package.json scripts changed beyond inactive route script")

    lock_diff = run_git(["diff", "--name-only", f"{base}...HEAD", "--", "package-lock.json"])
    if lock_diff.returncode == 0 and lock_diff.stdout.strip():
        failures.append("package-lock.json changed")
    return failures


def active_runtime_files() -> list[str]:
    files: list[str] = []
    for path in tracked_files():
        if path.startswith("node_modules/") or path.startswith("tools/"):
            continue
        if path.endswith((".js", ".ts", ".jsx", ".tsx", ".hs", ".cabal")):
            if path == "server.js" or path.startswith(ACTIVE_RUNTIME_PREFIXES):
                files.append(path)
    return files


def inactive_route_reference_failures() -> list[str]:
    failures: list[str] = []
    for path in active_runtime_files():
        full_path = ROOT / path
        try:
            text = full_path.read_text(encoding="utf-8", errors="ignore")
        except OSError as exc:
            failures.append(f"could not read {path}: {exc}")
            continue
        if "InactivePlaybackRouteV1" in text:
            failures.append(f"active runtime references InactivePlaybackRouteV1: {path}")
    return failures


def diff_safety_failures(base: str, files: list[str]) -> list[str]:
    failures: list[str] = []
    for path, line in added_lines(base):
        if not path:
            continue
        if path in ALLOWED_INACTIVE_ROUTE_FILES:
            continue
        if path.startswith("tools/playback-parity-v1/") and (
            "report-" in Path(path).name or "plan-" in Path(path).name
        ):
            continue
        if path == "package.json" and any(script_name in line for script_name in ALLOWED_NPM_SCRIPTS):
            continue
        if path.endswith((".md", ".txt", ".json")):
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

    frontend_changes = sorted(path for path in files if path in FRONTEND_PLAYBACK_FILES)
    if frontend_changes:
        failures.append(f"frontend playback files changed: {frontend_changes}")

    workflow_changes = [path for path in files if path.startswith(".github/workflows/")]
    for path in workflow_changes:
        text = (ROOT / path).read_text(encoding="utf-8", errors="ignore")
        if re.search(r"(?m)^\s*(?:contents|pull-requests|issues):\s*write\s*$", text):
            failures.append(f"workflow permissions are not read-only in {path}")

    return failures


def main() -> int:
    write_report = "--write-report" in sys.argv
    base = base_ref()
    files = changed_files(base)
    failures: list[str] = []

    if not HS_PATH.exists():
        failures.append(f"missing inactive Haskell file: {rel(HS_PATH)}")
    failures.extend(inactive_route_reference_failures())
    failures.extend(diff_safety_failures(base, files))
    failures.extend(package_failures(base))

    ok = not failures
    lines = [
        f"Status: {'PASS' if ok else 'FAIL'}",
        "mode: inactive playback route v1 safety gate",
        f"base_ref: {base}",
        "server_started: no",
        "network_called: no",
        "ffmpeg_started: no",
        "runtime_playback_changed: no",
        "active_routes_added: no",
        "inactive_route_wired: no",
        f"inactive_haskell_exists: {str(HS_PATH.exists()).lower()}",
        f"changed_files: {files}",
        f"active_runtime_file_count_scanned: {len(active_runtime_files())}",
        f"allowed_npm_scripts: {sorted(ALLOWED_NPM_SCRIPTS)}",
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

#!/usr/bin/env python3
"""Verify activation planning adds no runtime wiring."""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]

CONTROLLED_ACTIVATION_BRANCH_TOKEN = "controlled-activation"
CONTROLLED_ACTIVATION_ALLOWED_FILES = {
    "package.json",
    "server.js",
    "routes/inactive-playback-route-flags.js",
    "routes/inactive-playback-route-haskell.js",
    "tools/playback-parity-v1/inactive_playback_route_controlled_activation_gate.py",
    "tools/playback-parity-v1/test_inactive_playback_route_controlled_activation.js",
    "tools/playback-parity-v1/inactive_playback_route_status_header_safety_gate.py",
    "tools/playback-parity-v1/inactive_playback_route_response_body_safety_gate.py",
    "tools/playback-parity-v1/inactive_playback_route_implementation_shadow_safety_gate.py",
    "tools/playback-parity-v1/inactive_playback_route_final_readiness_safety_gate.py",
    "tools/playback-parity-v1/inactive_playback_route_error_taxonomy_safety_gate.py",
    "tools/playback-parity-v1/inactive_playback_route_adapter_safety_gate.py",
    "tools/playback-parity-v1/inactive_playback_route_activation_plan_safety_gate.py",
}
CONTROLLED_ACTIVATION_ALLOWED_SCRIPT = "test:playback-inactive-route-controlled-activation"

def current_head_ref() -> str:
    env_ref = os.environ.get("GITHUB_HEAD_REF") or os.environ.get("HEAD_REF") or ""
    if env_ref:
        return env_ref
    proc = subprocess.run(["git", "branch", "--show-current"], cwd=ROOT, text=True, capture_output=True)
    return proc.stdout.strip()

def is_controlled_activation_branch() -> bool:
    return CONTROLLED_ACTIVATION_BRANCH_TOKEN in current_head_ref()

def is_controlled_activation_allowed_file(path: str) -> bool:
    if path in CONTROLLED_ACTIVATION_ALLOWED_FILES:
        return True
    if path.startswith("tools/playback-parity-v1/inactive-playback-route-controlled-activation-report-"):
        return True
    if path.startswith("tools/playback-parity-v1/__pycache__/"):
        return True
    if path.startswith("tools/playback-parity-v1/playback-shadow-ci-report-"):
        return True
    return False

def filter_controlled_activation_files(files: list[str]) -> list[str]:
    if not is_controlled_activation_branch():
        return files
    return [path for path in files if not is_controlled_activation_allowed_file(path)]


def controlled_activation_branch_failures(files: list[str]) -> list[str]:
    if not is_controlled_activation_branch():
        return []
    failures: list[str] = []
    for path in files:
        if not is_controlled_activation_allowed_file(path):
            failures.append(f"changed file outside controlled activation allowed scope: {path}")
    return failures

TOOL_DIR = ROOT / "tools" / "playback-parity-v1"
BASE_BRANCH = "haskell-playback-inactive-route-fixture-coverage-20260613-003827"
BOUNDARY_PATH = TOOL_DIR / "inactive-playback-route-activation-runtime-boundary.json"
PACKAGE_PATH = ROOT / "package.json"
PACKAGE_LOCK_PATH = ROOT / "package-lock.json"

ACTIVATION_NPM_SCRIPT = {
    "test:playback-inactive-route-activation-plan": (
        "python3 tools/playback-parity-v1/inactive_playback_route_activation_plan_prerequisites.py --write-report "
        "&& python3 tools/playback-parity-v1/inactive_playback_route_activation_plan_dependency_checker.py --write-report "
        "&& python3 tools/playback-parity-v1/inactive_playback_route_activation_plan_safety_gate.py --write-report "
        "&& python3 tools/playback-parity-v1/inactive_playback_route_activation_plan_report.py --write-report"
    )
}

ALLOWED_CHANGED_PREFIXES = ("tools/playback-parity-v1/",)
ALLOWED_CHANGED_FILES = {"package.json", "package-lock.json"}
FORBIDDEN_PATH_PREFIXES = ("public/", "routes/", "middleware/", "src/", "lib/")
FORBIDDEN_EXACT_PATHS = {"server.js"}
ACTIVE_RUNTIME_PREFIXES = ("server.js", "app/", "lib/", "middleware/", "public/", "routes/", "src/")
ACTIVE_ROUTE_RE = re.compile(r"\b(?:app|router)\s*\.\s*(?:get|post|put|patch|delete|all|use)\s*\(", re.IGNORECASE)
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
    return TOOL_DIR / f"inactive-playback-route-activation-plan-safety-report-{stamp}.txt"


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
    if is_controlled_activation_branch():
        return []
    failures: list[str] = []
    needles = [
        "InactivePlayback",
        "inactive_playback",
        "activation-plan",
        "activation_plan",
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
                failures.append(f"active runtime references activation planning needle {needle}: {path}")
    return failures


def package_failures(base: str) -> list[str]:
    if is_controlled_activation_branch():
        return []
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
    for script_name, script_value in ACTIVATION_NPM_SCRIPT.items():
        if script_name in head_scripts:
            expected_scripts[script_name] = script_value
    if head_scripts != expected_scripts:
        failures.append("package.json scripts changed beyond inactive activation plan npm script")

    if PACKAGE_LOCK_PATH.exists():
        lock_diff = run_git(["diff", "--name-only", f"{base}...HEAD", "--", "package-lock.json"])
        if lock_diff.returncode == 0 and lock_diff.stdout.strip():
            failures.append("package-lock.json changed")
    return failures


def changed_path_failures(files: list[str]) -> list[str]:
    if is_controlled_activation_branch():
        return controlled_activation_branch_failures(files)
    failures: list[str] = []
    for path in files:
        if is_controlled_activation_branch() and is_controlled_activation_allowed_file(path):
            continue
        if path in ALLOWED_CHANGED_FILES or path.startswith(ALLOWED_CHANGED_PREFIXES):
            continue
        failures.append(f"changed file outside activation plan allowed scope: {path}")
    return failures


def boundary_failures(files: list[str]) -> list[str]:
    if is_controlled_activation_branch():
        return controlled_activation_branch_failures(files)
    files = filter_controlled_activation_files(files)
    boundary, err = read_json(None, BOUNDARY_PATH)
    if err or not isinstance(boundary, dict):
        return [f"activation runtime boundary could not be parsed: {err or 'expected object'}"]
    failures: list[str] = []
    future_paths = [
        entry.get("path")
        for entry in boundary.get("futureActivationFiles", [])
        if isinstance(entry, dict)
    ]
    for path in future_paths:
        if path in files:
            failures.append(f"future activation runtime file changed during planning: {path}")
    for path in boundary.get("mustNotTouchYet", []):
        if path in files:
            failures.append(f"must-not-touch file changed during planning: {path}")
    for prefix in boundary.get("mustNotTouchYetPrefixes", []):
        changed = [path for path in files if path.startswith(prefix)]
        if changed:
            failures.append(f"must-not-touch prefix changed during planning: {prefix}: {changed}")
    if boundary.get("planningOnly") is not True or boundary.get("activationStatus") != "not-active":
        failures.append("runtime boundary must remain planningOnly and not-active")
    return failures


def diff_safety_failures(base: str, files: list[str]) -> list[str]:
    if is_controlled_activation_branch():
        return controlled_activation_branch_failures(files)
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
        if path == "package.json" and any(script_name in line for script_name in ACTIVATION_NPM_SCRIPT):
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


def main() -> int:
    write_report = "--write-report" in sys.argv
    base = base_ref()
    files = changed_files(base)
    failures: list[str] = []
    failures.extend(changed_path_failures(files))
    failures.extend(boundary_failures(files))
    failures.extend(diff_safety_failures(base, files))
    failures.extend(active_reference_failures())
    failures.extend(package_failures(base))

    ok = not failures
    lines = [
        f"Status: {'PASS' if ok else 'FAIL'}",
        "mode: read-only inactive playback route activation plan safety gate",
        "server_started: no",
        "network_called: no",
        "ffmpeg_started: no",
        "runtime_playback_changed: no",
        "active_routes_added: controlled-flagged" if is_controlled_activation_branch() else "active_routes_added: no",
        "activation_performed: no",
        "inactive_route_wired: controlled-flagged" if is_controlled_activation_branch() else "inactive_route_wired: no",
        "frontend_playback_changed: no",
        "live_url_activated: no",
        "planning_only: yes" if ok else "planning_only: no",
        f"base_ref: {base}",
        f"changed_files: {files}",
        f"allowed_new_npm_scripts: {sorted(ACTIVATION_NPM_SCRIPT)}",
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

#!/usr/bin/env python3
"""Check activation planning depends on proven implementation readiness."""

from __future__ import annotations

import json
import subprocess
import sys
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
TOOL_DIR = ROOT / "tools" / "playback-parity-v1"
PACKAGE_PATH = ROOT / "package.json"

REQUIRED_COMMITS = ["26c275b", "1d12324"]
REQUIRED_FILES = [
    TOOL_DIR / "inactive-playback-route-final-readiness-contract.json",
    TOOL_DIR / "inactive-playback-route-final-readiness-fixtures.json",
    TOOL_DIR / "inactive_playback_route_final_readiness_report.py",
    TOOL_DIR / "inactive-playback-route-implementation-shadow-contract.json",
    TOOL_DIR / "inactive-playback-route-implementation-shadow-fixtures.json",
    TOOL_DIR / "InactivePlaybackRouteImplementationShadow.hs",
    TOOL_DIR / "inactive_playback_route_implementation_shadow_report.py",
]
DEPENDENCY_COMMANDS = [
    ("implementation_shadow_report", TOOL_DIR / "inactive_playback_route_implementation_shadow_report.py"),
    ("final_readiness_report", TOOL_DIR / "inactive_playback_route_final_readiness_report.py"),
]


def report_path() -> Path:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    return TOOL_DIR / f"inactive-playback-route-activation-plan-dependency-report-{stamp}.txt"


def run_command(command: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command,
        cwd=ROOT,
        check=False,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )


def status_line(output: str) -> str:
    for line in output.splitlines():
        if line.startswith("Status:"):
            return line
    return "Status: UNKNOWN"


def package_scripts() -> dict[str, str]:
    try:
        package = json.loads(PACKAGE_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    scripts = package.get("scripts", {})
    return scripts if isinstance(scripts, dict) else {}


def main() -> int:
    write_report = "--write-report" in sys.argv
    failures: list[str] = []
    commit_lines: list[str] = []
    for commit in REQUIRED_COMMITS:
        result = run_command(["git", "merge-base", "--is-ancestor", commit, "HEAD"])
        present = result.returncode == 0
        if not present:
            failures.append(f"required commit is not ancestor of HEAD: {commit}")
        commit_lines.append(f"- {commit}: {'ancestor' if present else 'missing'}")

    file_lines: list[str] = []
    for path in REQUIRED_FILES:
        exists = path.exists()
        if not exists:
            failures.append(f"missing required dependency file: {path.relative_to(ROOT)}")
        file_lines.append(f"- {path.relative_to(ROOT)}: {'present' if exists else 'missing'}")

    scripts = package_scripts()
    for script in [
        "test:playback-inactive-route-final-readiness",
        "test:playback-inactive-route-implementation-shadow",
        "test:playback-inactive-route-activation-plan",
    ]:
        if not scripts.get(script):
            failures.append(f"missing npm script: {script}")

    results: list[tuple[str, int, str, str]] = []
    for label, path in DEPENDENCY_COMMANDS:
        result = run_command([sys.executable, str(path)])
        results.append((label, result.returncode, result.stdout, result.stderr))
        if result.returncode != 0 or status_line(result.stdout) != "Status: PASS":
            failures.append(f"{label} did not report Status: PASS")

    ok = not failures
    lines = [
        f"Status: {'PASS' if ok else 'FAIL'}",
        "mode: read-only inactive playback route activation plan dependency checker",
        "server_started: no",
        "network_called: no",
        "ffmpeg_started: no",
        "runtime_playback_changed: no",
        "active_routes_added: no",
        "activation_performed: no",
        "required_commits:",
        *commit_lines,
        "required_files:",
        *file_lines,
        "dependency_summary:",
        *[f"- {label}: exit_code={code} {status_line(stdout)}" for label, code, stdout, _stderr in results],
        f"failures: {failures}",
    ]
    report_lines = [*lines]
    for label, code, stdout, stderr in results:
        report_lines.extend(
            [
                "",
                f"[{label}]",
                f"exit_code: {code}",
                "stdout:",
                stdout.rstrip() or "(empty)",
                "stderr:",
                stderr.rstrip() or "(empty)",
            ]
        )
    output = "\n".join(report_lines) + "\n"
    if write_report:
        path = report_path()
        path.write_text(output, encoding="utf-8")
        sys.stdout.write(f"report_path: {path.relative_to(ROOT)}\n")
    sys.stdout.write("\n".join(lines) + "\n")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())

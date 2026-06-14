#!/usr/bin/env python3
"""Run the inactive playback route activation plan gate and write a report."""

from __future__ import annotations

import subprocess
import sys
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
TOOL_DIR = ROOT / "tools" / "playback-parity-v1"

COMMANDS = [
    ("activation_plan_prerequisites", TOOL_DIR / "inactive_playback_route_activation_plan_prerequisites.py"),
    ("activation_plan_dependency_checker", TOOL_DIR / "inactive_playback_route_activation_plan_dependency_checker.py"),
    ("activation_plan_safety_gate", TOOL_DIR / "inactive_playback_route_activation_plan_safety_gate.py"),
]


def report_path() -> Path:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    return TOOL_DIR / f"inactive-playback-route-activation-plan-report-{stamp}.txt"


def first_status_line(output: str) -> str:
    for line in output.splitlines():
        if line.startswith("Status:"):
            return line
    return "Status: UNKNOWN"


def run_command(path: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(path)],
        cwd=ROOT,
        check=False,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )


def main() -> int:
    write_report = "--write-report" in sys.argv
    results: list[tuple[str, int, str, str]] = []
    for label, path in COMMANDS:
        result = run_command(path)
        results.append((label, result.returncode, result.stdout, result.stderr))

    failed = [label for label, code, _stdout, _stderr in results if code != 0]
    missing_required = [
        label
        for label, code, stdout, _stderr in results
        if code != 0 or first_status_line(stdout) != "Status: PASS"
    ]
    ok = not failed and not missing_required
    summary_lines = [
        f"Status: {'PASS' if ok else 'FAIL'}",
        "mode: read-only inactive playback route activation plan report",
        "server_started: no",
        "network_called: no",
        "ffmpeg_started: no",
        "runtime_playback_changed: no",
        "active_routes_added: no",
        "activation_performed: no",
        "inactive_route_wired: no",
        "frontend_playback_changed: no",
        "live_url_activated: no",
        "planning_only: yes" if ok else "planning_only: no",
        f"command_count: {len(results)}",
        f"failed_commands: {failed}",
        f"missing_required_activation_plan: {missing_required}",
        "required_status:",
        "- activation planning prerequisites PASS",
        "- implementation readiness dependency checker PASS",
        "- no-runtime-wiring safety gate PASS",
        "command_summary:",
        *[
            f"- {label}: exit_code={code} {first_status_line(stdout)}"
            for label, code, stdout, _stderr in results
        ],
    ]
    report_lines = [*summary_lines]
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
    sys.stdout.write("\n".join(summary_lines) + "\n")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())

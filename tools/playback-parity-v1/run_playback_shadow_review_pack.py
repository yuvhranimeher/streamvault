#!/usr/bin/env python3
"""Run playback shadow CI, workflow audit, and PR summary as a review pack."""

from __future__ import annotations

import subprocess
import sys
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
TOOL_DIR = ROOT / "tools" / "playback-parity-v1"

COMMANDS = [
    ("playback_shadow_ci", [sys.executable, str(TOOL_DIR / "run_playback_shadow_ci.py"), "--write-report"]),
    (
        "inactive_route_fixture_coverage_audit",
        [sys.executable, str(TOOL_DIR / "inactive_playback_route_fixture_coverage_audit.py"), "--write-report"],
    ),
    (
        "workflow_safety_audit",
        [sys.executable, str(TOOL_DIR / "playback_shadow_workflow_safety_audit.py"), "--write-report"],
    ),
    ("pr_summary", [sys.executable, str(TOOL_DIR / "playback_shadow_pr_summary.py"), "--write-report"]),
]


def report_path() -> Path:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    return TOOL_DIR / f"playback-shadow-review-pack-report-{stamp}.txt"


def first_status_line(output: str) -> str:
    for line in output.splitlines():
        if line.startswith("Status:"):
            return line
    return "Status: UNKNOWN"


def main() -> int:
    write_report = "--write-report" in sys.argv
    results: list[tuple[str, int, str, str]] = []
    for label, command in COMMANDS:
        result = subprocess.run(
            command,
            cwd=ROOT,
            check=False,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        results.append((label, result.returncode, result.stdout, result.stderr))

    failed = [label for label, code, _stdout, _stderr in results if code != 0]
    ok = not failed
    summary_lines = [
        f"Status: {'PASS' if ok else 'FAIL'}",
        "mode: read-only playback shadow review pack runner",
        "server_started: no",
        "network_called: no",
        "ffmpeg_started: no",
        "runtime_playback_changed: no",
        "active_routes_added: no",
        f"command_count: {len(results)}",
        f"failed_commands: {failed}",
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

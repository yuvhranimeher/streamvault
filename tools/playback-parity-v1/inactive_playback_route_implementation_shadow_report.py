#!/usr/bin/env python3
"""Run the inactive playback route implementation shadow report."""

from __future__ import annotations

import subprocess
import sys
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
TOOL_DIR = ROOT / "tools" / "playback-parity-v1"

COMMANDS = [
    ("implementation_shadow_js_vs_hs_compare", TOOL_DIR / "inactive_playback_route_implementation_shadow_js_vs_hs_compare.py"),
    ("implementation_shadow_envelope_gate", TOOL_DIR / "inactive_playback_route_implementation_shadow_envelope_gate.py"),
    ("implementation_shadow_fixture_coverage", TOOL_DIR / "inactive_playback_route_implementation_shadow_fixture_coverage_audit.py"),
    ("implementation_shadow_safety_gate", TOOL_DIR / "inactive_playback_route_implementation_shadow_safety_gate.py"),
]


def report_path() -> Path:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    return TOOL_DIR / f"inactive-playback-route-implementation-shadow-report-{stamp}.txt"


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
    ok = not failed
    summary_lines = [
        f"Status: {'PASS' if ok else 'FAIL'}",
        "mode: read-only inactive playback route implementation shadow report",
        "server_started: no",
        "network_called: no",
        "ffmpeg_started: no",
        "runtime_playback_changed: no",
        "active_routes_added: no",
        "inactive_route_wired: no",
        "frontend_playback_changed: no",
        "live_url_activated: no",
        "all_fixtures_safe: yes" if ok else "all_fixtures_safe: no",
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

#!/usr/bin/env python3
"""Run the final inactive playback route readiness gate and write a report."""

from __future__ import annotations

import subprocess
import sys
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
TOOL_DIR = ROOT / "tools" / "playback-parity-v1"

COMMANDS = [
    ("adapter_parity", TOOL_DIR / "inactive_playback_route_adapter_js_vs_hs_compare.py"),
    ("inactive_route_fixture_coverage", TOOL_DIR / "inactive_playback_route_fixture_coverage_audit.py"),
    ("response_body_parity", TOOL_DIR / "inactive_playback_route_response_body_js_vs_hs_compare.py"),
    ("response_body_envelope", TOOL_DIR / "inactive_playback_route_response_body_envelope_gate.py"),
    ("response_body_fixture_coverage", TOOL_DIR / "inactive_playback_route_response_body_fixture_coverage_audit.py"),
    ("status_header_parity", TOOL_DIR / "inactive_playback_route_status_header_js_vs_hs_compare.py"),
    ("status_header_envelope", TOOL_DIR / "inactive_playback_route_status_header_envelope_gate.py"),
    ("status_header_fixture_coverage", TOOL_DIR / "inactive_playback_route_status_header_fixture_coverage_audit.py"),
    ("error_taxonomy_parity", TOOL_DIR / "inactive_playback_route_error_taxonomy_js_vs_hs_compare.py"),
    ("error_taxonomy_envelope", TOOL_DIR / "inactive_playback_route_error_taxonomy_envelope_gate.py"),
    ("error_taxonomy_fixture_coverage", TOOL_DIR / "inactive_playback_route_error_taxonomy_fixture_coverage_audit.py"),
    ("final_readiness_js_vs_hs_compare", TOOL_DIR / "inactive_playback_route_final_readiness_js_vs_hs_compare.py"),
    ("final_readiness_safety_gate", TOOL_DIR / "inactive_playback_route_final_readiness_safety_gate.py"),
]

REQUIRED_COMPONENTS = {
    "adapter_parity": "adapter parity PASS",
    "response_body_parity": "response body parity PASS",
    "status_header_parity": "status/header parity PASS",
    "error_taxonomy_parity": "error taxonomy parity PASS",
    "final_readiness_safety_gate": "final readiness safety PASS",
}


def report_path() -> Path:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    return TOOL_DIR / f"inactive-playback-route-final-readiness-report-{stamp}.txt"


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
        description
        for label, description in REQUIRED_COMPONENTS.items()
        if any(result_label == label and (code != 0 or first_status_line(stdout) != "Status: PASS") for result_label, code, stdout, _stderr in results)
    ]
    ok = not failed and not missing_required
    summary_lines = [
        f"Status: {'PASS' if ok else 'FAIL'}",
        "mode: read-only inactive playback route final readiness report",
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
        f"missing_required_readiness: {missing_required}",
        "required_component_status:",
        *[f"- {description}" for description in REQUIRED_COMPONENTS.values()],
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

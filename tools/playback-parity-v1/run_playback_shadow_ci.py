#!/usr/bin/env python3
"""Run all read-only playback shadow gates as a local CI check."""

from __future__ import annotations

import subprocess
import sys
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
TOOL_DIR = ROOT / "tools" / "playback-parity-v1"

GATES = [
    ("planner_fixture_schema", TOOL_DIR / "playback_planner_fixture_schema.py"),
    ("shadow_planner_gate", TOOL_DIR / "playback_shadow_planner_gate.py"),
    ("js_vs_haskell_shadow_compare", TOOL_DIR / "playback_js_vs_hs_shadow_compare.py"),
    ("route_inventory_schema_gate", TOOL_DIR / "playback_route_inventory_schema_gate.py"),
    ("route_fixture_schema_gate", TOOL_DIR / "playback_route_fixture_schema_gate.py"),
    ("inactive_route_response_envelope_gate", TOOL_DIR / "inactive_playback_route_response_envelope_gate.py"),
    ("inactive_route_fixture_coverage_audit", TOOL_DIR / "inactive_playback_route_fixture_coverage_audit.py"),
    ("inactive_route_adapter_js_vs_hs_compare", TOOL_DIR / "inactive_playback_route_adapter_js_vs_hs_compare.py"),
    ("inactive_route_adapter_safety_gate", TOOL_DIR / "inactive_playback_route_adapter_safety_gate.py"),
    ("inactive_route_response_body_js_vs_hs_compare", TOOL_DIR / "inactive_playback_route_response_body_js_vs_hs_compare.py"),
    ("inactive_route_response_body_envelope_gate", TOOL_DIR / "inactive_playback_route_response_body_envelope_gate.py"),
    ("inactive_route_response_body_fixture_coverage_audit", TOOL_DIR / "inactive_playback_route_response_body_fixture_coverage_audit.py"),
    ("inactive_route_response_body_safety_gate", TOOL_DIR / "inactive_playback_route_response_body_safety_gate.py"),
    ("inactive_route_status_header_js_vs_hs_compare", TOOL_DIR / "inactive_playback_route_status_header_js_vs_hs_compare.py"),
    ("inactive_route_status_header_envelope_gate", TOOL_DIR / "inactive_playback_route_status_header_envelope_gate.py"),
    ("inactive_route_status_header_fixture_coverage_audit", TOOL_DIR / "inactive_playback_route_status_header_fixture_coverage_audit.py"),
    ("inactive_route_status_header_safety_gate", TOOL_DIR / "inactive_playback_route_status_header_safety_gate.py"),
    ("route_contract_crosscheck", TOOL_DIR / "playback_route_contract_crosscheck.py"),
    ("route_contract_js_vs_hs_compare", TOOL_DIR / "playback_route_contract_js_vs_hs_compare.py"),
    ("route_shadow_full_gate", TOOL_DIR / "playback_route_shadow_full_gate.py"),
]


def report_path() -> Path:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    return TOOL_DIR / f"playback-shadow-ci-report-{stamp}.txt"


def run_gate(path: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(path)],
        cwd=ROOT,
        check=False,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )


def first_status_line(output: str) -> str:
    for line in output.splitlines():
        if line.startswith("Status:"):
            return line
    return "Status: UNKNOWN"


def main() -> int:
    write_report = "--write-report" in sys.argv
    results: list[tuple[str, int, str, str]] = []

    for label, path in GATES:
        result = run_gate(path)
        results.append((label, result.returncode, result.stdout, result.stderr))

    failed = [label for label, code, _stdout, _stderr in results if code != 0]
    ok = not failed
    summary_lines = [
        f"Status: {'PASS' if ok else 'FAIL'}",
        "mode: read-only playback shadow local CI runner",
        "server_started: no",
        "network_called: no",
        "ffmpeg_started: no",
        "runtime_playback_changed: no",
        "active_routes_added: no",
        f"gate_count: {len(results)}",
        f"failed_gates: {failed}",
        "gate_summary:",
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

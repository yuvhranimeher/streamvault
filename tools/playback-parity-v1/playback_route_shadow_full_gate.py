#!/usr/bin/env python3
"""Run the complete read-only playback route shadow gate."""

from __future__ import annotations

import subprocess
import sys
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
TOOL_DIR = ROOT / "tools" / "playback-parity-v1"

GATES = [
    ("inventory_schema_gate", TOOL_DIR / "playback_route_inventory_schema_gate.py"),
    ("fixture_schema_gate", TOOL_DIR / "playback_route_fixture_schema_gate.py"),
    ("contract_crosscheck", TOOL_DIR / "playback_route_contract_crosscheck.py"),
    ("js_vs_haskell_route_comparator", TOOL_DIR / "playback_route_contract_js_vs_hs_compare.py"),
]


def report_path() -> Path:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    return TOOL_DIR / f"playback-route-shadow-full-gate-report-{stamp}.txt"


def run_gate(path: Path) -> subprocess.CompletedProcess[str]:
    command = [sys.executable, str(path)]
    return subprocess.run(
        command,
        cwd=ROOT,
        check=False,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )


def main() -> int:
    write_report = "--write-report" in sys.argv
    results: list[tuple[str, int, str, str]] = []
    for label, path in GATES:
        result = run_gate(path)
        results.append((label, result.returncode, result.stdout, result.stderr))

    failures = [label for label, code, _stdout, _stderr in results if code != 0]
    ok = not failures
    lines = [
        f"Status: {'PASS' if ok else 'FAIL'}",
        "mode: read-only playback route shadow full gate",
        "server_started: no",
        "network_called: no",
        "runtime_playback_changed: no",
        "active_routes_added: no",
        f"gate_count: {len(results)}",
        f"failed_gates: {failures}",
    ]
    for label, code, stdout, stderr in results:
        lines.extend(
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
    output = "\n".join(lines) + "\n"
    if write_report:
        path = report_path()
        path.write_text(output, encoding="utf-8")
        sys.stdout.write(f"report_path: {path.relative_to(ROOT)}\n")
    sys.stdout.write(output)
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())

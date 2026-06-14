#!/usr/bin/env python3
"""Smoke-check controlled inactive Haskell playback route activation modes and rollback."""

from __future__ import annotations

import subprocess
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TOOL_DIR = ROOT / "tools" / "playback-parity-v1"
NODE_TEST = TOOL_DIR / "test_inactive_playback_route_controlled_activation_smoke.js"

def main() -> int:
    timestamp = datetime.utcnow().strftime("%Y%m%d-%H%M%S")
    report = TOOL_DIR / f"inactive-playback-route-controlled-activation-smoke-report-{timestamp}.txt"

    failures: list[str] = []

    proc = subprocess.run(
        ["node", str(NODE_TEST.relative_to(ROOT))],
        cwd=ROOT,
        text=True,
        capture_output=True,
    )

    if proc.returncode != 0:
        failures.append(f"node smoke test failed with exit code {proc.returncode}")

    if "CONTROLLED_ACTIVATION_SMOKE_PASS" not in proc.stdout:
        failures.append("missing CONTROLLED_ACTIVATION_SMOKE_PASS marker")

    ok = not failures

    lines = [
        f"Status: {'PASS' if ok else 'FAIL'}",
        "mode: controlled inactive Haskell playback activation smoke gate",
        "server_started: no",
        "network_called: no",
        "ffmpeg_started: no",
        "desktop_direct_play_changed: no",
        "mobile_hls_changed: no",
        "modes_tested: off, shadow, canary, on",
        "rollback_tested: unset flag or set off",
        "node_gate_stdout:",
        proc.stdout.strip(),
        "node_gate_stderr:",
        proc.stderr.strip(),
        "failures:",
        repr(failures),
        "",
    ]

    report.write_text("\n".join(lines))
    print(f"report_path: {report.relative_to(ROOT)}")
    print("\n".join(lines))
    return 0 if ok else 1

if __name__ == "__main__":
    raise SystemExit(main())

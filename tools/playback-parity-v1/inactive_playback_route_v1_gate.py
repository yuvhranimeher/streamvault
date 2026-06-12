#!/usr/bin/env python3
"""Compare inactive Haskell playback route v1 output against frozen route decisions."""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
TOOL_DIR = ROOT / "tools" / "playback-parity-v1"
HS_PATH = TOOL_DIR / "InactivePlaybackRouteV1.hs"
FIXTURE_PATH = TOOL_DIR / "playback-route-contract-fixtures.json"
JS_PATH = TOOL_DIR / "playback_route_contract_shadow_js.js"
EXISTING_COMPARE = TOOL_DIR / "playback_route_contract_js_vs_hs_compare.py"


def report_path() -> Path:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    return TOOL_DIR / f"inactive-playback-route-v1-gate-report-{stamp}.txt"


def run_command(command: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command,
        cwd=ROOT,
        check=False,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )


def parse_json(label: str, text: str) -> tuple[Any | None, list[str]]:
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError as exc:
        return None, [f"{label}: JSON parse failed: {exc}"]
    if not isinstance(parsed, list):
        return None, [f"{label}: output must be a JSON array"]
    return parsed, []


def normalized(value: Any) -> str:
    return json.dumps(value, indent=2, sort_keys=True, separators=(",", ": ")) + "\n"


def compile_inactive(ghc: str, tmp_dir: Path) -> tuple[Path | None, str, list[str]]:
    binary = tmp_dir / "InactivePlaybackRouteV1"
    result = run_command([ghc, "-O0", "-outputdir", str(tmp_dir), "-o", str(binary), str(HS_PATH)])
    if result.returncode != 0:
        return None, "failed", [result.stderr.strip() or result.stdout.strip() or "ghc compile failed"]
    return binary, "passed", []


def main() -> int:
    write_report = "--write-report" in sys.argv
    ghc = shutil.which("ghc")
    node = shutil.which("node")
    failures: list[str] = []

    if not ghc:
        failures.append("ghc unavailable")
    if not node:
        failures.append("node unavailable")
    if not HS_PATH.exists():
        failures.append(f"missing inactive Haskell file: {HS_PATH.relative_to(ROOT)}")

    compile_status = "skipped"
    inactive_run_status = "skipped"
    js_run_status = "skipped"
    existing_compare_status = "skipped"
    normalized_compare_status = "skipped"
    inactive_output: Any | None = None
    js_output: Any | None = None
    existing_compare_stdout = ""
    existing_compare_stderr = ""

    if ghc and node and HS_PATH.exists():
        with tempfile.TemporaryDirectory(prefix="sv-inactive-route-v1-") as tmp:
            binary, compile_status, compile_failures = compile_inactive(ghc, Path(tmp))
            failures.extend(f"compile: {failure}" for failure in compile_failures)
            if binary is not None:
                inactive = run_command([str(binary), str(FIXTURE_PATH)])
                if inactive.returncode != 0:
                    inactive_run_status = "failed"
                    failures.append(inactive.stderr.strip() or inactive.stdout.strip() or "inactive route run failed")
                else:
                    inactive_output, parse_failures = parse_json("inactive", inactive.stdout)
                    inactive_run_status = "failed" if parse_failures else "passed"
                    failures.extend(parse_failures)

            js = run_command([node, str(JS_PATH), str(FIXTURE_PATH)])
            if js.returncode != 0:
                js_run_status = "failed"
                failures.append(js.stderr.strip() or js.stdout.strip() or "JS frozen route shadow failed")
            else:
                js_output, parse_failures = parse_json("javascript", js.stdout)
                js_run_status = "failed" if parse_failures else "passed"
                failures.extend(parse_failures)

            existing = run_command([sys.executable, str(EXISTING_COMPARE)])
            existing_compare_stdout = existing.stdout
            existing_compare_stderr = existing.stderr
            existing_compare_status = "passed" if existing.returncode == 0 else "failed"
            if existing.returncode != 0:
                failures.append("existing route contract JS/Haskell comparator failed")

    if inactive_output is not None and js_output is not None:
        normalized_compare_status = "passed" if normalized(inactive_output) == normalized(js_output) else "failed"
        if normalized_compare_status != "passed":
            failures.append("inactive Haskell output differs from frozen JS route contract decisions")

    ok = not failures and normalized_compare_status == "passed"
    lines = [
        f"Status: {'PASS' if ok else 'FAIL'}",
        "mode: read-only inactive playback route v1 comparator gate",
        "server_started: no",
        "network_called: no",
        "ffmpeg_started: no",
        "runtime_playback_changed: no",
        "active_routes_added: no",
        "inactive_route_wired: no",
        f"ghc_available: {str(ghc is not None).lower()}",
        f"node_available: {str(node is not None).lower()}",
        f"inactive_haskell: {HS_PATH.relative_to(ROOT)}",
        f"fixture_path: {FIXTURE_PATH.relative_to(ROOT)}",
        f"compile_status: {compile_status}",
        f"inactive_run_status: {inactive_run_status}",
        f"js_run_status: {js_run_status}",
        f"existing_route_comparator_status: {existing_compare_status}",
        f"normalized_compare_status: {normalized_compare_status}",
        f"inactive_decision_count: {len(inactive_output) if isinstance(inactive_output, list) else 0}",
        f"js_decision_count: {len(js_output) if isinstance(js_output, list) else 0}",
        "existing_route_comparator_stdout:",
        existing_compare_stdout.rstrip() or "(empty)",
        "existing_route_comparator_stderr:",
        existing_compare_stderr.rstrip() or "(empty)",
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

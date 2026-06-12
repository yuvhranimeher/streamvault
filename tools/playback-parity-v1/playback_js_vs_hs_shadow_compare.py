#!/usr/bin/env python3
"""Compare pure JS and Haskell playback shadow planner output."""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
TOOL_DIR = ROOT / "tools" / "playback-parity-v1"
HS_PATH = TOOL_DIR / "PlaybackShadowPlanner.hs"
JS_PATH = TOOL_DIR / "playback_shadow_planner_js.js"
FIXTURE_PATH = TOOL_DIR / "playback-planner-fixtures.json"
REPORT_PATH = TOOL_DIR / "playback-js-vs-hs-shadow-compare-report-20260612-181036.txt"


def run_command(command: list[str], cwd: Path = ROOT) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command,
        cwd=cwd,
        check=False,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )


def parse_json_output(label: str, output: str) -> tuple[Any | None, list[str]]:
    try:
        parsed = json.loads(output)
    except json.JSONDecodeError as exc:
        return None, [f"{label}: JSON parse failed: {exc}"]
    if not isinstance(parsed, list):
        return None, [f"{label}: output must be a JSON array"]
    return parsed, []


def normalized_json(value: Any) -> str:
    return json.dumps(value, indent=2, sort_keys=True, separators=(",", ": ")) + "\n"


def compile_haskell(ghc: str, tmp_dir: Path) -> tuple[Path | None, str, list[str]]:
    binary = tmp_dir / "PlaybackShadowPlanner"
    result = run_command([ghc, "-O0", "-outputdir", str(tmp_dir), "-o", str(binary), str(HS_PATH)])
    if result.returncode != 0:
        detail = result.stderr.strip() or result.stdout.strip() or "ghc compile failed"
        return None, "failed", [detail]
    return binary, "passed", []


def run_haskell(binary: Path) -> tuple[Any | None, str, list[str]]:
    result = run_command([str(binary), str(FIXTURE_PATH)])
    if result.returncode != 0:
        detail = result.stderr.strip() or result.stdout.strip() or "Haskell planner failed"
        return None, "failed", [detail]
    parsed, parse_failures = parse_json_output("haskell", result.stdout)
    return parsed, "failed" if parse_failures else "passed", parse_failures


def run_javascript(node: str) -> tuple[Any | None, str, list[str]]:
    result = run_command([node, str(JS_PATH), str(FIXTURE_PATH)])
    if result.returncode != 0:
        detail = result.stderr.strip() or result.stdout.strip() or "JS planner failed"
        return None, "failed", [detail]
    parsed, parse_failures = parse_json_output("javascript", result.stdout)
    return parsed, "failed" if parse_failures else "passed", parse_failures


def main() -> int:
    write_report = "--write-report" in sys.argv
    node = shutil.which("node")
    ghc = shutil.which("ghc")
    failures: list[str] = []

    if not node:
        failures.append("node unavailable: install/load Node.js before running comparator")
    if not ghc:
        failures.append("ghc unavailable: install/load GHC before running comparator")

    compile_status = "skipped"
    haskell_status = "skipped"
    javascript_status = "skipped"
    compare_status = "skipped"
    haskell_output: Any | None = None
    javascript_output: Any | None = None

    if node and ghc:
        with tempfile.TemporaryDirectory(prefix="sv-js-vs-hs-playback-") as tmp:
            binary, compile_status, compile_failures = compile_haskell(ghc, Path(tmp))
            failures.extend(f"compile: {failure}" for failure in compile_failures)
            if binary is not None:
                haskell_output, haskell_status, haskell_failures = run_haskell(binary)
                failures.extend(f"haskell: {failure}" for failure in haskell_failures)
            javascript_output, javascript_status, javascript_failures = run_javascript(node)
            failures.extend(f"javascript: {failure}" for failure in javascript_failures)

    if haskell_output is not None and javascript_output is not None:
        haskell_normalized = normalized_json(haskell_output)
        javascript_normalized = normalized_json(javascript_output)
        compare_status = "passed" if haskell_normalized == javascript_normalized else "failed"
        if compare_status == "failed":
            failures.append("normalized JS planner output differs from normalized Haskell planner output")

    ok = not failures and compare_status == "passed"
    lines = [
        f"Status: {'PASS' if ok else 'FAIL'}",
        "mode: read-only JS vs Haskell playback shadow planner comparison",
        "server_started: no",
        "network_called: no",
        "ffmpeg_started: no",
        "runtime_playback_changed: no",
        f"node_available: {str(node is not None).lower()}",
        f"ghc_available: {str(ghc is not None).lower()}",
        f"haskell_compile: {compile_status}",
        f"haskell_run: {haskell_status}",
        f"javascript_run: {javascript_status}",
        f"normalized_compare: {compare_status}",
        f"fixture_path: {FIXTURE_PATH.relative_to(ROOT)}",
        f"haskell_planner: {HS_PATH.relative_to(ROOT)}",
        f"javascript_planner: {JS_PATH.relative_to(ROOT)}",
        f"haskell_plan_count: {len(haskell_output) if isinstance(haskell_output, list) else 0}",
        f"javascript_plan_count: {len(javascript_output) if isinstance(javascript_output, list) else 0}",
        f"failures: {failures}",
    ]
    output = "\n".join(lines) + "\n"
    if write_report:
        REPORT_PATH.write_text(output, encoding="utf-8")
    sys.stdout.write(output)
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())

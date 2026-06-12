#!/usr/bin/env python3
"""Read-only playback shadow planner parity gate.

When ghc is available this compiles/runs PlaybackShadowPlanner.hs and validates
its JSON output. Without ghc it performs source and fixture static validation
and reports compiled validation as skipped.
"""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
HS_PATH = ROOT / "tools" / "playback-parity-v1" / "PlaybackShadowPlanner.hs"
FIXTURE_PATH = ROOT / "tools" / "playback-parity-v1" / "playback-planner-fixtures.json"
EXPECTED_PATH = ROOT / "tools" / "playback-parity-v1" / "playback-shadow-planner-expected-output.json"
REPORT_PATH = ROOT / "tools" / "playback-parity-v1" / "playback-shadow-planner-gate-report-20260612-101247.txt"

REQUIRED_SOURCE_TOKENS = {
    "module_main": "module Main where",
    "main": "main :: IO ()",
    "read_fixture": "readFile path",
    "plan_fixture": "planFixture :: Fixture -> Plan",
    "missing_stream_invalid": "Missing streamUrl",
    "desktop_direct": "Desktop streamUrl maps to direct shadow playback without FFmpeg.",
    "mobile_hls": "Mobile compatibility fixture maps to HLS shadow playback.",
    "live_m3u8": "Live TV m3u8 source maps to live shadow playback.",
    "json_output": "plansJson",
}

FORBIDDEN_SOURCE_TOKENS = {
    "network_import": "Network.",
    "http_client": "http-client",
    "system_process": "System.Process",
    "create_process": "createProcess",
    "shell": "shell ",
    "ffmpeg_literal": "spawn",
    "node_server": "listen(",
}

EXPECTED_DECISIONS = {
    "desktop_movie_direct_ftp": ("direct", True, False, False),
    "mobile_movie_hls_required": ("hls", True, True, True),
    "series_episode_direct": ("direct", True, False, False),
    "live_tv_hls_m3u8": ("live", True, False, False),
    "invalid_missing_streamUrl": ("invalid", False, False, False),
}


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def static_source_validation() -> tuple[list[str], list[str]]:
    source = HS_PATH.read_text(encoding="utf-8")
    missing = [name for name, token in REQUIRED_SOURCE_TOKENS.items() if token not in source]
    forbidden = [name for name, token in FORBIDDEN_SOURCE_TOKENS.items() if token in source]
    return missing, forbidden


def validate_fixture_contract(fixtures: list[dict[str, Any]]) -> list[str]:
    failures: list[str] = []
    names = {fixture.get("name") for fixture in fixtures}
    missing_names = sorted(set(EXPECTED_DECISIONS) - names)
    if missing_names:
        failures.append(f"missing fixtures: {missing_names}")
    for fixture in fixtures:
        name = fixture.get("name")
        if name not in EXPECTED_DECISIONS:
            continue
        expected_mode, expected_ok, expected_transcode, expected_ffmpeg = EXPECTED_DECISIONS[name]
        if not isinstance(fixture.get("input"), dict) or not fixture["input"].get("id"):
            failures.append(f"{name}: missing input.id")
        if name != "invalid_missing_streamUrl" and not fixture.get("streamUrl"):
            failures.append(f"{name}: missing streamUrl")
        if name == "invalid_missing_streamUrl" and fixture.get("streamUrl"):
            failures.append(f"{name}: expected empty streamUrl")
        if name == "live_tv_hls_m3u8" and ".m3u8" not in str(fixture.get("streamUrl", "")).lower():
            failures.append(f"{name}: expected m3u8 streamUrl")
        if fixture.get("playbackMode") != expected_mode and name != "invalid_missing_streamUrl":
            failures.append(f"{name}: fixture playbackMode drifted from {expected_mode}")
        if fixture.get("requiresTranscode") != expected_transcode and name != "invalid_missing_streamUrl":
            failures.append(f"{name}: fixture requiresTranscode drifted")
        if fixture.get("shouldUseFfmpeg") != expected_ffmpeg and name != "invalid_missing_streamUrl":
            failures.append(f"{name}: fixture shouldUseFfmpeg drifted")
        if bool(fixture.get("expectedValid")) != expected_ok:
            failures.append(f"{name}: expectedValid drifted")
    return failures


def validate_plan_output(plans: list[dict[str, Any]]) -> list[str]:
    failures: list[str] = []
    seen = {plan.get("fixtureName"): plan for plan in plans}
    for name, (mode, ok, transcode, ffmpeg) in EXPECTED_DECISIONS.items():
        plan = seen.get(name)
        if not plan:
            failures.append(f"{name}: missing plan output")
            continue
        for field in ["inputId", "fixtureName", "sourceType", "clientType", "playbackMode", "requiresTranscode", "shouldUseFfmpeg", "streamUrl", "reason", "ok"]:
            if field not in plan:
                failures.append(f"{name}: missing output field {field}")
        if plan.get("playbackMode") != mode:
            failures.append(f"{name}: playbackMode expected {mode}, got {plan.get('playbackMode')}")
        if plan.get("ok") is not ok:
            failures.append(f"{name}: ok expected {ok}, got {plan.get('ok')}")
        if plan.get("requiresTranscode") is not transcode:
            failures.append(f"{name}: requiresTranscode expected {transcode}, got {plan.get('requiresTranscode')}")
        if plan.get("shouldUseFfmpeg") is not ffmpeg:
            failures.append(f"{name}: shouldUseFfmpeg expected {ffmpeg}, got {plan.get('shouldUseFfmpeg')}")
        if name != "invalid_missing_streamUrl" and not plan.get("streamUrl"):
            failures.append(f"{name}: output missing streamUrl")
    return failures


def compile_and_run() -> tuple[str, list[dict[str, Any]] | None, list[str]]:
    ghc = shutil.which("ghc")
    if not ghc:
        return "skipped: ghc unavailable", None, []
    with tempfile.TemporaryDirectory(prefix="sv-playback-shadow-") as tmp:
        binary = Path(tmp) / "PlaybackShadowPlanner"
        compile_result = subprocess.run(
            [ghc, "-O0", "-outputdir", tmp, "-o", str(binary), str(HS_PATH)],
            cwd=ROOT,
            check=False,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        if compile_result.returncode != 0:
            return "failed: ghc compile error", None, [compile_result.stderr.strip() or compile_result.stdout.strip()]
        run_result = subprocess.run(
            [str(binary), str(FIXTURE_PATH)],
            cwd=ROOT,
            check=False,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        if run_result.returncode != 0:
            return "failed: planner run error", None, [run_result.stderr.strip() or run_result.stdout.strip()]
        try:
            parsed = json.loads(run_result.stdout)
        except json.JSONDecodeError as exc:
            return "failed: output JSON parse error", None, [str(exc)]
        if not isinstance(parsed, list):
            return "failed: output is not JSON array", None, ["planner output must be an array"]
        return "passed", parsed, []


def main() -> int:
    write_report = "--write-report" in sys.argv
    fixtures = load_json(FIXTURE_PATH)
    if not isinstance(fixtures, list):
        raise SystemExit("Fixture file must contain a JSON array")
    fixture_dicts = [item for item in fixtures if isinstance(item, dict)]

    missing_source, forbidden_source = static_source_validation()
    fixture_failures = validate_fixture_contract(fixture_dicts)
    compiled_status, actual_plans, compiled_failures = compile_and_run()
    output_failures = validate_plan_output(actual_plans) if actual_plans is not None else []
    expected_compare_status = "skipped: expected output fixture not present"
    expected_compare_failures: list[str] = []
    if actual_plans is not None and EXPECTED_PATH.exists():
        expected = load_json(EXPECTED_PATH)
        expected_compare_status = "passed" if expected == actual_plans else "failed"
        if expected != actual_plans:
            expected_compare_failures.append("actual Haskell output differs from expected output fixture")

    failures = missing_source + forbidden_source + fixture_failures + compiled_failures + output_failures + expected_compare_failures
    ok = not missing_source and not forbidden_source and not fixture_failures and not compiled_failures and not output_failures and not expected_compare_failures
    lines = [
        f"Status: {'PASS' if ok else 'FAIL'}",
        "mode: read-only playback shadow planner parity gate",
        "server_started: no",
        "media_sources_called: no",
        "ffmpeg_started: no",
        "runtime_playback_changed: no",
        f"ghc_available: {str(shutil.which('ghc') is not None).lower()}",
        f"compiled_validation: {compiled_status}",
        f"expected_output_compare: {expected_compare_status}",
        f"fixture_count: {len(fixture_dicts)}",
        f"missing_source_tokens: {missing_source}",
        f"forbidden_source_tokens: {forbidden_source}",
        f"fixture_failures: {fixture_failures}",
        f"compiled_failures: {compiled_failures}",
        f"output_failures: {output_failures}",
        f"expected_compare_failures: {expected_compare_failures}",
        "expected_decisions:",
        *[
            f"- {name}: playbackMode={mode} ok={ok_value} requiresTranscode={transcode} shouldUseFfmpeg={ffmpeg}"
            for name, (mode, ok_value, transcode, ffmpeg) in EXPECTED_DECISIONS.items()
        ],
        f"failure_summary: {failures}",
    ]
    output = "\n".join(lines) + "\n"
    if write_report:
        REPORT_PATH.write_text(output, encoding="utf-8")
    sys.stdout.write(output)
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())

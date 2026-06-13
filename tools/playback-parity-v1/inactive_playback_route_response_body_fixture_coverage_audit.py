#!/usr/bin/env python3
"""Audit inactive playback route response body fixture coverage."""

from __future__ import annotations

import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Callable


ROOT = Path(__file__).resolve().parents[2]
TOOL_DIR = ROOT / "tools" / "playback-parity-v1"
FIXTURE_PATH = TOOL_DIR / "inactive-playback-route-response-body-fixtures.json"
CONTRACT_PATH = TOOL_DIR / "inactive-playback-route-response-body-contract.json"
HS_PATH = TOOL_DIR / "InactivePlaybackRouteResponseBody.hs"
JS_PATH = TOOL_DIR / "inactive_playback_route_response_body_shadow_js.js"

CoverageCheck = Callable[[dict[str, Any]], bool]


def report_path() -> Path:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    return TOOL_DIR / f"inactive-playback-route-response-body-fixture-coverage-report-{stamp}.txt"


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def text(value: Any) -> str:
    return str(value or "")


def valid_shape(shape: str) -> CoverageCheck:
    return lambda fixture: fixture.get("expectedValid") is True and fixture.get("expectedResponseShape") == shape


def invalid_bucket(bucket: str) -> CoverageCheck:
    return lambda fixture: fixture.get("expectedValid") is False and fixture.get("expectedFailureBucket") == bucket


REQUIRED_COVERAGE: list[tuple[str, CoverageCheck]] = [
    ("movie JSON response body", valid_shape("movie-json")),
    ("FTP JSON desktop direct response body", lambda fixture: valid_shape("ftp-json")(fixture) and fixture.get("clientType") == "desktop"),
    ("FTP JSON mobile HLS response body", lambda fixture: valid_shape("ftp-json")(fixture) and fixture.get("clientType") == "mobile"),
    ("local JSON response body", valid_shape("local-json")),
    ("raw byte metadata response body", valid_shape("raw-bytes")),
    ("series episode JSON response body", valid_shape("series-json")),
    ("live HLS response body", valid_shape("live-hls")),
    ("invalid missing route", invalid_bucket("missing_route")),
    ("invalid missing streamUrl", invalid_bucket("missing_streamUrl")),
    ("invalid unsupported clientType", invalid_bucket("unsupported_clientType")),
    ("invalid unsupported sourceType", invalid_bucket("unsupported_sourceType")),
    ("invalid unsupported playbackMode", invalid_bucket("unsupported_playbackMode")),
    ("invalid unsafe streamUrl", invalid_bucket("unsafe_streamUrl")),
]


def matching_names(fixtures: list[dict[str, Any]], check: CoverageCheck) -> list[str]:
    return [text(fixture.get("name")) for fixture in fixtures if check(fixture)]


def main() -> int:
    write_report = "--write-report" in sys.argv
    failures: list[str] = []

    fixtures_raw = load_json(FIXTURE_PATH)
    contract_raw = load_json(CONTRACT_PATH)
    if not isinstance(fixtures_raw, list):
        raise SystemExit("Fixture file must contain a JSON array")
    if not isinstance(contract_raw, dict):
        raise SystemExit("Contract file must contain a JSON object")

    fixtures = [fixture for fixture in fixtures_raw if isinstance(fixture, dict)]
    contract_shapes = contract_raw.get("responseShapes", {})
    if not isinstance(contract_shapes, dict):
        failures.append("contract responseShapes must be an object")
        contract_shapes = {}

    coverage_lines: list[str] = []
    for label, check in REQUIRED_COVERAGE:
        names = matching_names(fixtures, check)
        if not names:
            failures.append(f"missing fixture coverage: {label}")
        coverage_lines.append(f"- {label}: {'present' if names else 'missing'} fixtures={names}")

    fixture_shapes = {text(fixture.get("expectedResponseShape")) for fixture in fixtures}
    missing_contract_shapes = sorted(shape for shape in fixture_shapes if shape and shape not in contract_shapes)
    if missing_contract_shapes:
        failures.append(f"fixture shapes missing from contract: {missing_contract_shapes}")

    shadow_checks = {
        "haskell_exists": HS_PATH.exists(),
        "javascript_exists": JS_PATH.exists(),
        "haskell_shadow_banner": "INACTIVE SHADOW-ONLY ROUTE RESPONSE BODY" in HS_PATH.read_text(encoding="utf-8", errors="ignore") if HS_PATH.exists() else False,
        "js_no_server_listen": "listen(" not in JS_PATH.read_text(encoding="utf-8", errors="ignore") if JS_PATH.exists() else False,
        "js_no_fetch": "fetch(" not in JS_PATH.read_text(encoding="utf-8", errors="ignore") if JS_PATH.exists() else False,
    }
    for label, passed in shadow_checks.items():
        if not passed:
            failures.append(f"response body shadow check failed: {label}")

    ok = not failures
    lines = [
        f"Status: {'PASS' if ok else 'FAIL'}",
        "mode: read-only inactive playback route response body fixture coverage audit",
        "server_started: no",
        "network_called: no",
        "ffmpeg_started: no",
        "runtime_playback_changed: no",
        "active_routes_added: no",
        "inactive_route_wired: no",
        f"fixture_path: {FIXTURE_PATH.relative_to(ROOT)}",
        f"contract_path: {CONTRACT_PATH.relative_to(ROOT)}",
        f"haskell_shadow: {HS_PATH.relative_to(ROOT)}",
        f"javascript_shadow: {JS_PATH.relative_to(ROOT)}",
        f"fixture_count: {len(fixtures)}",
        f"contract_shapes: {sorted(contract_shapes)}",
        f"fixture_shapes: {sorted(fixture_shapes)}",
        "coverage:",
        *coverage_lines,
        f"shadow_checks: {shadow_checks}",
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

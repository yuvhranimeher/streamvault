#!/usr/bin/env python3
"""Audit inactive playback route status/header fixture coverage."""

from __future__ import annotations

import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
TOOL_DIR = ROOT / "tools" / "playback-parity-v1"
FIXTURE_PATH = TOOL_DIR / "inactive-playback-route-status-header-fixtures.json"
CONTRACT_PATH = TOOL_DIR / "inactive-playback-route-status-header-contract.json"
HS_PATH = TOOL_DIR / "InactivePlaybackRouteStatusHeader.hs"
JS_PATH = TOOL_DIR / "inactive_playback_route_status_header_shadow_js.js"


def report_path() -> Path:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    return TOOL_DIR / f"inactive-playback-route-status-header-fixture-coverage-report-{stamp}.txt"


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


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
    if len(fixtures) != len(fixtures_raw):
        failures.append("fixture file contains non-object entries")

    fixture_ids = [str(fixture.get("fixtureId") or "") for fixture in fixtures]
    duplicate_ids = sorted({fixture_id for fixture_id in fixture_ids if fixture_ids.count(fixture_id) > 1})
    if duplicate_ids:
        failures.append(f"duplicate fixture ids: {duplicate_ids}")

    required_coverage = contract_raw.get("requiredCoverage", [])
    if not isinstance(required_coverage, list):
        failures.append("contract requiredCoverage must be a list")
        required_coverage = []
    coverage_lines: list[str] = []
    for bucket in required_coverage:
        names = [str(fixture.get("fixtureId")) for fixture in fixtures if fixture.get("coverageBucket") == bucket]
        if not names:
            failures.append(f"missing fixture coverage: {bucket}")
        coverage_lines.append(f"- {bucket}: {'present' if names else 'missing'} fixtures={names}")

    accepted_methods = set(contract_raw.get("acceptedMethods", []))
    accepted_shapes = set(contract_raw.get("acceptedBodyShapes", []))
    observed_statuses = sorted({fixture.get("expectedStatus") for fixture in fixtures})
    observed_methods = sorted({fixture.get("method") for fixture in fixtures})
    observed_shapes = sorted({fixture.get("expectedBodyShape") for fixture in fixtures})
    for fixture in fixtures:
        fixture_id = str(fixture.get("fixtureId") or "unknown")
        if fixture.get("expectedDecision") == "accepted" and fixture.get("method") not in accepted_methods:
            failures.append(f"{fixture_id}: accepted fixture uses unsupported method")
        if fixture.get("expectedBodyShape") not in accepted_shapes:
            failures.append(f"{fixture_id}: expectedBodyShape missing from contract")
        headers = fixture.get("expectedHeaders")
        if not isinstance(headers, dict):
            failures.append(f"{fixture_id}: expectedHeaders must be object")
        elif "cache-control" not in headers or "content-type" not in headers:
            failures.append(f"{fixture_id}: expectedHeaders must include cache-control and content-type")

    shadow_checks = {
        "haskell_exists": HS_PATH.exists(),
        "javascript_exists": JS_PATH.exists(),
        "haskell_shadow_banner": "INACTIVE SHADOW-ONLY ROUTE STATUS HEADER" in HS_PATH.read_text(encoding="utf-8", errors="ignore") if HS_PATH.exists() else False,
        "js_no_server_listen": "listen(" not in JS_PATH.read_text(encoding="utf-8", errors="ignore") if JS_PATH.exists() else False,
        "js_no_fetch": "fetch(" not in JS_PATH.read_text(encoding="utf-8", errors="ignore") if JS_PATH.exists() else False,
    }
    for label, passed in shadow_checks.items():
        if not passed:
            failures.append(f"status/header shadow check failed: {label}")

    ok = not failures
    lines = [
        f"Status: {'PASS' if ok else 'FAIL'}",
        "mode: read-only inactive playback route status/header fixture coverage audit",
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
        f"observed_statuses: {observed_statuses}",
        f"observed_methods: {observed_methods}",
        f"observed_shapes: {observed_shapes}",
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

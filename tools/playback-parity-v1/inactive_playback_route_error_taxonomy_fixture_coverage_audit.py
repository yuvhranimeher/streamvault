#!/usr/bin/env python3
"""Audit inactive playback route error taxonomy fixture coverage."""

from __future__ import annotations

import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
TOOL_DIR = ROOT / "tools" / "playback-parity-v1"
FIXTURE_PATH = TOOL_DIR / "inactive-playback-route-error-taxonomy-fixtures.json"
CONTRACT_PATH = TOOL_DIR / "inactive-playback-route-error-taxonomy-contract.json"
HS_PATH = TOOL_DIR / "InactivePlaybackRouteErrorTaxonomy.hs"
JS_PATH = TOOL_DIR / "inactive_playback_route_error_taxonomy_shadow_js.js"


def report_path() -> Path:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    return TOOL_DIR / f"inactive-playback-route-error-taxonomy-fixture-coverage-report-{stamp}.txt"


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def fixture_url_failures(fixture: dict[str, Any]) -> list[str]:
    fixture_id = str(fixture.get("fixtureId") or "unknown")
    stream_url = str(fixture.get("streamUrl") or "")
    reason = str(fixture.get("expectedReasonCode") or "")
    failures: list[str] = []
    if "localhost" in stream_url or "127.0.0.1" in stream_url:
        failures.append(f"{fixture_id}: localhost fixture URL is forbidden")
    if stream_url.startswith("placeholder://"):
        if reason != "UNSAFE_PLACEHOLDER_URL":
            failures.append(f"{fixture_id}: placeholder URL must be the unsafe placeholder fixture")
        return failures
    if stream_url.startswith("local://") or stream_url == "":
        return failures
    failures.append(f"{fixture_id}: fixture URL must be empty, local, or placeholder only")
    return failures


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

    contract_categories = set(str(value) for value in contract_raw.get("errorCategories", []))
    observed_categories = sorted({str(fixture.get("expectedErrorCategory") or "") for fixture in fixtures})
    missing_categories = sorted(contract_categories - set(observed_categories))
    extra_categories = sorted(set(observed_categories) - contract_categories)
    if missing_categories:
        failures.append(f"missing stable error categories: {missing_categories}")
    if extra_categories:
        failures.append(f"unexpected error categories: {extra_categories}")

    status_by_reason = contract_raw.get("statusByReasonCode", {})
    category_by_reason = contract_raw.get("categoryByReasonCode", {})
    retryable_by_reason = contract_raw.get("retryableByReasonCode", {})
    error_code_by_category = contract_raw.get("errorCodeByCategory", {})
    accepted_shapes = set(contract_raw.get("acceptedBodyShapes", []))
    observed_reasons = sorted({fixture.get("expectedReasonCode") for fixture in fixtures})
    observed_statuses = sorted({fixture.get("expectedStatus") for fixture in fixtures})
    observed_methods = sorted({fixture.get("method") for fixture in fixtures})
    observed_shapes = sorted({fixture.get("expectedBodyShape") for fixture in fixtures})

    for fixture in fixtures:
        fixture_id = str(fixture.get("fixtureId") or "unknown")
        reason = str(fixture.get("expectedReasonCode") or "")
        category = str(fixture.get("expectedErrorCategory") or "")
        if status_by_reason.get(reason) != fixture.get("expectedStatus"):
            failures.append(f"{fixture_id}: expectedStatus does not match contract")
        if category_by_reason.get(reason) != category:
            failures.append(f"{fixture_id}: expectedErrorCategory does not match contract")
        if retryable_by_reason.get(reason) != fixture.get("expectedRetryable"):
            failures.append(f"{fixture_id}: expectedRetryable does not match contract")
        if error_code_by_category.get(category) != fixture.get("expectedErrorCode"):
            failures.append(f"{fixture_id}: expectedErrorCode does not match contract")
        if fixture.get("expectedBodyShape") not in accepted_shapes:
            failures.append(f"{fixture_id}: expectedBodyShape missing from contract")
        headers = fixture.get("expectedHeaders")
        if not isinstance(headers, dict):
            failures.append(f"{fixture_id}: expectedHeaders must be object")
        elif "cache-control" not in headers or "content-type" not in headers:
            failures.append(f"{fixture_id}: expectedHeaders must include cache-control and content-type")
        failures.extend(fixture_url_failures(fixture))

    shadow_checks = {
        "haskell_exists": HS_PATH.exists(),
        "javascript_exists": JS_PATH.exists(),
        "haskell_shadow_banner": "INACTIVE SHADOW-ONLY ROUTE ERROR TAXONOMY" in HS_PATH.read_text(encoding="utf-8", errors="ignore") if HS_PATH.exists() else False,
        "js_no_server_listen": "listen(" not in JS_PATH.read_text(encoding="utf-8", errors="ignore") if JS_PATH.exists() else False,
        "js_no_fetch": "fetch(" not in JS_PATH.read_text(encoding="utf-8", errors="ignore") if JS_PATH.exists() else False,
        "js_no_spawn": "spawn(" not in JS_PATH.read_text(encoding="utf-8", errors="ignore") if JS_PATH.exists() else False,
        "js_no_exec": "exec(" not in JS_PATH.read_text(encoding="utf-8", errors="ignore") if JS_PATH.exists() else False,
    }
    for label, passed in shadow_checks.items():
        if not passed:
            failures.append(f"error taxonomy shadow check failed: {label}")

    ok = not failures
    lines = [
        f"Status: {'PASS' if ok else 'FAIL'}",
        "mode: read-only inactive playback route error taxonomy fixture coverage audit",
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
        f"observed_reasons: {observed_reasons}",
        f"observed_categories: {observed_categories}",
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

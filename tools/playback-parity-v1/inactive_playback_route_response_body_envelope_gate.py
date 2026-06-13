#!/usr/bin/env python3
"""Validate inactive playback route response body envelopes."""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parents[2]
TOOL_DIR = ROOT / "tools" / "playback-parity-v1"
FIXTURE_PATH = TOOL_DIR / "inactive-playback-route-response-body-fixtures.json"
JS_PATH = TOOL_DIR / "inactive_playback_route_response_body_shadow_js.js"
CONTRACT_PATH = TOOL_DIR / "inactive-playback-route-response-body-contract.json"

ENVELOPE_FIELDS = {
    "ok",
    "route",
    "routeTarget",
    "sourceType",
    "clientType",
    "responseKind",
    "playbackMode",
    "requiresTranscode",
    "shouldUseFfmpeg",
    "streamUrl",
    "statusCode",
    "errorCode",
    "responseShape",
    "responsePayload",
    "reason",
    "safety",
}
SAFETY_FIELDS = {
    "serverStarted",
    "networkCalled",
    "ffmpegStarted",
    "runtimePlaybackChanged",
    "activeRoutesAdded",
    "inactiveRouteWired",
    "frontendPlaybackChanged",
    "localhostUrlActivated",
}
ERROR_CODES = {
    "MISSING_ROUTE",
    "UNKNOWN_ROUTE",
    "MISSING_STREAM_URL",
    "UNSAFE_STREAM_URL",
    "UNSUPPORTED_CLIENT_TYPE",
    "UNSUPPORTED_SOURCE_TYPE",
    "UNSUPPORTED_PLAYBACK_MODE",
}


def report_path() -> Path:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    return TOOL_DIR / f"inactive-playback-route-response-body-envelope-report-{stamp}.txt"


def run_command(command: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command,
        cwd=ROOT,
        check=False,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def parse_decisions(output: str) -> tuple[list[dict[str, Any]], list[str]]:
    try:
        parsed = json.loads(output)
    except json.JSONDecodeError as exc:
        return [], [f"decision JSON parse failed: {exc}"]
    if not isinstance(parsed, list):
        return [], ["decision output must be a JSON array"]
    decisions = [item for item in parsed if isinstance(item, dict)]
    if len(decisions) != len(parsed):
        return decisions, ["decision output contains non-object entries"]
    return decisions, []


def safe_fixture_url(value: str) -> bool:
    if not value:
        return True
    if value.startswith(("local://", "placeholder://")):
        return True
    parsed = urlparse(value)
    if parsed.scheme in {"http", "https", "ftp"}:
        return (parsed.hostname or "").endswith(".example.test")
    return False if parsed.scheme else True


def payload_shape_failures(shape: str, payload: Any, contract: dict[str, Any], name: str) -> list[str]:
    if not isinstance(payload, dict):
        return [f"{name}: responsePayload must be an object"]
    shapes = contract.get("responseShapes", {})
    expected_fields = shapes.get(shape) if isinstance(shapes, dict) else None
    if not isinstance(expected_fields, list):
        return [f"{name}: responseShape is not in contract: {shape}"]
    actual_fields = sorted(str(key) for key in payload)
    expected_sorted = sorted(str(key) for key in expected_fields)
    if actual_fields != expected_sorted:
        return [f"{name}: payload fields {actual_fields} != expected {expected_sorted}"]
    return []


def validate_decision(fixture: dict[str, Any], decision: dict[str, Any], contract: dict[str, Any]) -> list[str]:
    failures: list[str] = []
    name = str(fixture.get("name") or decision.get("caseName") or "unknown")
    missing = sorted(ENVELOPE_FIELDS - set(decision))
    if missing:
        failures.append(f"{name}: missing envelope fields {missing}")
        return failures

    expected_valid = fixture.get("expectedValid") is True
    if decision.get("route") != decision.get("routeTarget"):
        failures.append(f"{name}: route must match routeTarget")
    if decision.get("routeTarget") != fixture.get("routeTarget", ""):
        failures.append(f"{name}: routeTarget differs from fixture")
    if decision.get("sourceType") != fixture.get("sourceType", ""):
        failures.append(f"{name}: sourceType differs from fixture")
    if decision.get("clientType") != fixture.get("clientType", ""):
        failures.append(f"{name}: clientType differs from fixture")
    if decision.get("streamUrl") != fixture.get("streamUrl", ""):
        failures.append(f"{name}: streamUrl differs from fixture")
    if not isinstance(decision.get("requiresTranscode"), bool):
        failures.append(f"{name}: requiresTranscode must be boolean")
    if not isinstance(decision.get("shouldUseFfmpeg"), bool):
        failures.append(f"{name}: shouldUseFfmpeg must be boolean")
    if not isinstance(decision.get("statusCode"), int):
        failures.append(f"{name}: statusCode must be integer")
    if not isinstance(decision.get("reason"), str) or not decision.get("reason", "").strip():
        failures.append(f"{name}: reason must be present")

    safety = decision.get("safety")
    if not isinstance(safety, dict):
        failures.append(f"{name}: safety must be an object")
    else:
        missing_safety = sorted(SAFETY_FIELDS - set(safety))
        if missing_safety:
            failures.append(f"{name}: missing safety fields {missing_safety}")
        for key in SAFETY_FIELDS:
            if safety.get(key) is not False:
                failures.append(f"{name}: safety.{key} must be false")

    shape = str(decision.get("responseShape") or "")
    failures.extend(payload_shape_failures(shape, decision.get("responsePayload"), contract, name))

    if expected_valid:
        if decision.get("ok") is not True:
            failures.append(f"{name}: valid fixture must have ok true")
        if decision.get("statusCode") not in {200, 206}:
            failures.append(f"{name}: valid fixture must have statusCode 200 or 206")
        if decision.get("errorCode") != "":
            failures.append(f"{name}: valid fixture must have empty errorCode")
        if shape != fixture.get("expectedResponseShape"):
            failures.append(f"{name}: responseShape differs from expected fixture shape")
    else:
        if decision.get("ok") is not False:
            failures.append(f"{name}: invalid fixture must have ok false")
        if decision.get("statusCode") == 200:
            failures.append(f"{name}: invalid fixture must have non-200 statusCode")
        if decision.get("errorCode") not in ERROR_CODES:
            failures.append(f"{name}: invalid fixture errorCode must be in taxonomy")
        if shape != "error-json":
            failures.append(f"{name}: invalid fixture must use error-json responseShape")

    if not safe_fixture_url(str(decision.get("streamUrl") or "")):
        failures.append(f"{name}: unsafe non-placeholder streamUrl")
    return failures


def main() -> int:
    write_report = "--write-report" in sys.argv
    failures: list[str] = []
    node = shutil.which("node")
    if not node:
        failures.append("node unavailable")

    fixtures_raw = load_json(FIXTURE_PATH)
    contract_raw = load_json(CONTRACT_PATH)
    if not isinstance(fixtures_raw, list):
        raise SystemExit("Fixture file must contain a JSON array")
    if not isinstance(contract_raw, dict):
        raise SystemExit("Contract file must contain a JSON object")
    fixtures = [item for item in fixtures_raw if isinstance(item, dict)]
    if len(fixtures) != len(fixtures_raw):
        failures.append("fixture file contains non-object entries")

    decisions: list[dict[str, Any]] = []
    js_status = "skipped"
    if node:
        result = run_command([node, str(JS_PATH), str(FIXTURE_PATH)])
        if result.returncode != 0:
            js_status = "failed"
            failures.append(result.stderr.strip() or result.stdout.strip() or "JS response body shadow failed")
        else:
            decisions, parse_failures = parse_decisions(result.stdout)
            js_status = "failed" if parse_failures else "passed"
            failures.extend(parse_failures)

    if len(decisions) != len(fixtures):
        failures.append(f"decision count {len(decisions)} does not match fixture count {len(fixtures)}")

    decision_lines: list[str] = []
    for fixture, decision in zip(fixtures, decisions):
        decision_failures = validate_decision(fixture, decision, contract_raw)
        failures.extend(decision_failures)
        decision_lines.append(
            f"- {fixture.get('name')}: ok={decision.get('ok')} statusCode={decision.get('statusCode')} "
            f"shape={decision.get('responseShape')} errorCode={decision.get('errorCode')} failures={decision_failures}"
        )

    ok = not failures
    lines = [
        f"Status: {'PASS' if ok else 'FAIL'}",
        "mode: read-only inactive playback route response body envelope gate",
        "server_started: no",
        "network_called: no",
        "ffmpeg_started: no",
        "runtime_playback_changed: no",
        "active_routes_added: no",
        "inactive_route_wired: no",
        f"fixture_path: {FIXTURE_PATH.relative_to(ROOT)}",
        f"contract_path: {CONTRACT_PATH.relative_to(ROOT)}",
        f"decision_source: {JS_PATH.relative_to(ROOT)}",
        f"node_available: {str(node is not None).lower()}",
        f"js_status: {js_status}",
        f"fixture_count: {len(fixtures)}",
        f"decision_count: {len(decisions)}",
        "decisions:",
        *decision_lines,
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

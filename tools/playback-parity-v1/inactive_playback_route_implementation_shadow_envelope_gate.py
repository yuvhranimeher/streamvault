#!/usr/bin/env python3
"""Validate inactive playback route implementation shadow envelopes."""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
TOOL_DIR = ROOT / "tools" / "playback-parity-v1"
FIXTURE_PATH = TOOL_DIR / "inactive-playback-route-implementation-shadow-fixtures.json"
CONTRACT_PATH = TOOL_DIR / "inactive-playback-route-implementation-shadow-contract.json"
JS_PATH = TOOL_DIR / "inactive_playback_route_implementation_shadow_js.js"

REQUIRED_FIELDS = [
    "fixtureId",
    "routeDecision",
    "ok",
    "status",
    "headers",
    "body",
    "errorTaxonomy",
    "adapterDecision",
    "responseBodyDecision",
    "statusHeaderDecision",
    "safetyNotes",
]
REQUIRED_SAFETY_NOTES = [
    "shadow-only",
    "fixture-only",
    "no-server",
    "no-network",
    "no-ffmpeg",
    "no-active-runtime-wiring",
    "no-live-url-activation",
]


def report_path() -> Path:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    return TOOL_DIR / f"inactive-playback-route-implementation-shadow-envelope-report-{stamp}.txt"


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def run_js(node: str) -> tuple[list[Any], str, list[str]]:
    result = subprocess.run(
        [node, str(JS_PATH), str(FIXTURE_PATH)],
        cwd=ROOT,
        check=False,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    if result.returncode != 0:
        return [], "failed", [result.stderr.strip() or result.stdout.strip() or "JS implementation shadow failed"]
    try:
        parsed = json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        return [], "failed", [f"JS output could not be parsed: {exc}"]
    if not isinstance(parsed, list):
        return [], "failed", ["JS output must be an array"]
    return parsed, "passed", []


def result_failures(fixture: dict[str, Any], result: dict[str, Any]) -> list[str]:
    failures: list[str] = []
    for field in REQUIRED_FIELDS:
        if field not in result:
            failures.append(f"missing field {field}")

    if result.get("fixtureId") != fixture.get("fixtureId"):
        failures.append("fixtureId mismatch")
    if result.get("routeDecision") != fixture.get("expectedRouteDecision"):
        failures.append(f"routeDecision mismatch: {result.get('routeDecision')} != {fixture.get('expectedRouteDecision')}")
    if result.get("ok") != fixture.get("expectedOk"):
        failures.append(f"ok mismatch: {result.get('ok')} != {fixture.get('expectedOk')}")
    if result.get("status") != fixture.get("expectedStatus"):
        failures.append(f"status mismatch: {result.get('status')} != {fixture.get('expectedStatus')}")
    if result.get("bodyShape") != fixture.get("expectedBodyShape"):
        failures.append(f"bodyShape mismatch: {result.get('bodyShape')} != {fixture.get('expectedBodyShape')}")
    if result.get("reasonCode") != fixture.get("expectedReasonCode"):
        failures.append(f"reasonCode mismatch: {result.get('reasonCode')} != {fixture.get('expectedReasonCode')}")

    headers = result.get("headers")
    body = result.get("body")
    taxonomy = result.get("errorTaxonomy")
    adapter = result.get("adapterDecision")
    response_body = result.get("responseBodyDecision")
    status_header = result.get("statusHeaderDecision")
    notes = result.get("safetyNotes")
    if not isinstance(headers, dict):
        failures.append("headers must be an object")
    elif headers.get("x-streamvault-shadow") != "inactive-route-implementation-shadow-v1":
        failures.append("missing implementation shadow header")
    if not isinstance(body, dict):
        failures.append("body must be an object")
    if not isinstance(taxonomy, dict):
        failures.append("errorTaxonomy must be an object")
    elif taxonomy.get("errorCode") != fixture.get("expectedErrorCode"):
        failures.append(f"errorCode mismatch: {taxonomy.get('errorCode')} != {fixture.get('expectedErrorCode')}")
    if not isinstance(adapter, dict):
        failures.append("adapterDecision must be an object")
    if not isinstance(response_body, dict):
        failures.append("responseBodyDecision must be an object")
    if not isinstance(status_header, dict):
        failures.append("statusHeaderDecision must be an object")
    if notes != REQUIRED_SAFETY_NOTES:
        failures.append(f"safetyNotes mismatch: {notes}")
    return failures


def main() -> int:
    write_report = "--write-report" in sys.argv
    node = shutil.which("node")
    failures: list[str] = []
    fixtures = load_json(FIXTURE_PATH)
    contract = load_json(CONTRACT_PATH)
    decisions: list[Any] = []
    js_status = "skipped"

    if not node:
        failures.append("node unavailable")
    if not isinstance(fixtures, list):
        failures.append("fixtures must be an array")
        fixtures = []
    if contract.get("requiredOutputFields") != REQUIRED_FIELDS:
        failures.append("contract requiredOutputFields mismatch")
    if contract.get("requiredSafetyNotes") != REQUIRED_SAFETY_NOTES:
        failures.append("contract requiredSafetyNotes mismatch")

    if node and not failures:
        decisions, js_status, js_failures = run_js(node)
        failures.extend(js_failures)

    if len(decisions) != len(fixtures):
        failures.append(f"decision count mismatch: {len(decisions)} != {len(fixtures)}")

    decision_lines: list[str] = []
    for fixture, decision in zip(fixtures, decisions):
        if not isinstance(fixture, dict) or not isinstance(decision, dict):
            failures.append("fixture and decision entries must be objects")
            continue
        entry_failures = result_failures(fixture, decision)
        failures.extend(f"{fixture.get('fixtureId')}: {failure}" for failure in entry_failures)
        decision_lines.append(
            "- "
            f"{fixture.get('fixtureId')}: "
            f"routeDecision={decision.get('routeDecision')} "
            f"status={decision.get('status')} "
            f"reasonCode={decision.get('reasonCode')} "
            f"failures={entry_failures}"
        )

    ok = not failures
    lines = [
        f"Status: {'PASS' if ok else 'FAIL'}",
        "mode: read-only inactive playback route implementation shadow envelope gate",
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
        "decision_summary:",
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

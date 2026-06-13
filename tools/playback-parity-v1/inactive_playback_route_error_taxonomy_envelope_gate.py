#!/usr/bin/env python3
"""Validate inactive playback route error taxonomy envelopes."""

from __future__ import annotations

import json
import re
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parents[2]
TOOL_DIR = ROOT / "tools" / "playback-parity-v1"
FIXTURE_PATH = TOOL_DIR / "inactive-playback-route-error-taxonomy-fixtures.json"
JS_PATH = TOOL_DIR / "inactive_playback_route_error_taxonomy_shadow_js.js"
CONTRACT_PATH = TOOL_DIR / "inactive-playback-route-error-taxonomy-contract.json"

ENVELOPE_FIELDS = {
    "fixtureId",
    "decision",
    "ok",
    "status",
    "errorCode",
    "errorCategory",
    "reasonCode",
    "userSafeMessage",
    "developerDetail",
    "retryable",
    "headers",
    "bodyShape",
    "safetyNotes",
}
FORBIDDEN_HEADERS = {"date", "server", "set-cookie", "x-request-id"}
FORBIDDEN_TEXT = re.compile(
    r"(?:https?://|ftps?://|localhost|127\.0\.0\.1|/Users/|Traceback|stack trace|password|secret|token)",
    re.IGNORECASE,
)
TIMESTAMP_TEXT = re.compile(r"\b\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}:\d{2})?\b")


def report_path() -> Path:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    return TOOL_DIR / f"inactive-playback-route-error-taxonomy-envelope-report-{stamp}.txt"


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


def safe_fixture_url(value: str, expected_reason: str) -> list[str]:
    if not value:
        return []
    if value.startswith("placeholder://"):
        if expected_reason != "UNSAFE_PLACEHOLDER_URL":
            return ["placeholder URL is only allowed for unsafe placeholder fixture"]
        return []
    if value.startswith("local://"):
        return []
    parsed = urlparse(value)
    if parsed.scheme in {"http", "https", "ftp"}:
        if (parsed.hostname or "").endswith(".example.test"):
            return []
        return [f"fixture URL host is not .example.test: {parsed.hostname}"]
    return [f"fixture URL scheme is not allowed: {value}"]


def header_failures(headers: Any, expected_headers: Any, name: str) -> list[str]:
    failures: list[str] = []
    if not isinstance(headers, dict):
        return [f"{name}: headers must be an object"]
    if not isinstance(expected_headers, dict):
        return [f"{name}: expectedHeaders must be an object"]

    keys = list(headers)
    if keys != sorted(keys):
        failures.append(f"{name}: header keys must be sorted")
    for key, value in headers.items():
        if key.lower() != key:
            failures.append(f"{name}: header key is not lowercase: {key}")
        if key in FORBIDDEN_HEADERS:
            failures.append(f"{name}: forbidden runtime header emitted: {key}")
        if not isinstance(value, str):
            failures.append(f"{name}: header value must be string: {key}")
    if headers != expected_headers:
        failures.append(f"{name}: headers differ from fixture expectation")
    if "cache-control" not in headers:
        failures.append(f"{name}: cache-control header missing")
    if "content-type" not in headers:
        failures.append(f"{name}: content-type header missing")
    if headers.get("x-streamvault-shadow") != "inactive-route-error-taxonomy-v1":
        failures.append(f"{name}: shadow header mismatch")
    return failures


def deterministic_text_failures(decision: dict[str, Any], name: str) -> list[str]:
    failures: list[str] = []
    serialized = json.dumps(decision, sort_keys=True)
    if FORBIDDEN_TEXT.search(serialized):
        failures.append(f"{name}: decision contains forbidden URL/path/secret/stack text")
    if TIMESTAMP_TEXT.search(serialized):
        failures.append(f"{name}: decision contains date or timestamp text")
    for key in ["userSafeMessage", "developerDetail"]:
        value = decision.get(key)
        if not isinstance(value, str) or not value.strip():
            failures.append(f"{name}: {key} must be a non-empty string")
    return failures


def validate_decision(fixture: dict[str, Any], decision: dict[str, Any], contract: dict[str, Any]) -> list[str]:
    failures: list[str] = []
    name = str(fixture.get("fixtureId") or "unknown")
    missing = sorted(ENVELOPE_FIELDS - set(decision))
    if missing:
        failures.append(f"{name}: missing envelope fields {missing}")
        return failures

    if set(decision) != ENVELOPE_FIELDS:
        failures.append(f"{name}: envelope fields differ from contract: {sorted(decision)}")
    for field, expected_field in [
        ("fixtureId", "fixtureId"),
        ("decision", "expectedDecision"),
        ("ok", "expectedOk"),
        ("status", "expectedStatus"),
        ("errorCode", "expectedErrorCode"),
        ("errorCategory", "expectedErrorCategory"),
        ("reasonCode", "expectedReasonCode"),
        ("userSafeMessage", "expectedUserSafeMessage"),
        ("developerDetail", "expectedDeveloperDetail"),
        ("retryable", "expectedRetryable"),
        ("bodyShape", "expectedBodyShape"),
    ]:
        if decision.get(field) != fixture.get(expected_field):
            failures.append(f"{name}: {field} differs from fixture expectation")

    if decision.get("decision") != "rejected":
        failures.append(f"{name}: error taxonomy decisions must be rejected")
    if decision.get("ok") is not False:
        failures.append(f"{name}: error taxonomy decisions must have ok false")
    if not isinstance(decision.get("status"), int):
        failures.append(f"{name}: status must be an integer")
    if not isinstance(decision.get("retryable"), bool):
        failures.append(f"{name}: retryable must be a boolean")

    categories = contract.get("errorCategories", [])
    if decision.get("errorCategory") not in categories:
        failures.append(f"{name}: errorCategory missing from stable contract categories")

    status_by_reason = contract.get("statusByReasonCode", {})
    category_by_reason = contract.get("categoryByReasonCode", {})
    retryable_by_reason = contract.get("retryableByReasonCode", {})
    error_code_by_category = contract.get("errorCodeByCategory", {})
    reason_code = decision.get("reasonCode")
    category = decision.get("errorCategory")
    if isinstance(status_by_reason, dict) and reason_code in status_by_reason:
        if decision.get("status") != status_by_reason.get(reason_code):
            failures.append(f"{name}: status does not match contract reason taxonomy")
    else:
        failures.append(f"{name}: reasonCode missing from contract status taxonomy")
    if isinstance(category_by_reason, dict) and category_by_reason.get(reason_code) != category:
        failures.append(f"{name}: errorCategory does not match contract reason taxonomy")
    if isinstance(retryable_by_reason, dict) and retryable_by_reason.get(reason_code) != decision.get("retryable"):
        failures.append(f"{name}: retryable does not match contract reason taxonomy")
    if isinstance(error_code_by_category, dict) and error_code_by_category.get(category) != decision.get("errorCode"):
        failures.append(f"{name}: errorCode does not match contract category taxonomy")

    accepted_shapes = contract.get("acceptedBodyShapes", [])
    if decision.get("bodyShape") not in accepted_shapes:
        failures.append(f"{name}: bodyShape missing from accepted contract shapes")

    failures.extend(header_failures(decision.get("headers"), fixture.get("expectedHeaders"), name))

    expected_safety = contract.get("safetyNotes")
    if decision.get("safetyNotes") != expected_safety:
        failures.append(f"{name}: safetyNotes differ from contract")

    failures.extend(safe_fixture_url(str(fixture.get("streamUrl") or ""), str(fixture.get("expectedReasonCode") or "")))
    failures.extend(deterministic_text_failures(decision, name))
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
            failures.append(result.stderr.strip() or result.stdout.strip() or "JS error taxonomy shadow failed")
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
            f"- {fixture.get('fixtureId')}: category={decision.get('errorCategory')} "
            f"status={decision.get('status')} reasonCode={decision.get('reasonCode')} "
            f"retryable={decision.get('retryable')} failures={decision_failures}"
        )

    ok = not failures
    lines = [
        f"Status: {'PASS' if ok else 'FAIL'}",
        "mode: read-only inactive playback route error taxonomy envelope gate",
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

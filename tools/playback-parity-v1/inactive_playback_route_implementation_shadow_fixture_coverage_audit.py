#!/usr/bin/env python3
"""Audit inactive playback route implementation shadow fixture coverage."""

from __future__ import annotations

import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parents[2]
TOOL_DIR = ROOT / "tools" / "playback-parity-v1"
FIXTURE_PATH = TOOL_DIR / "inactive-playback-route-implementation-shadow-fixtures.json"
CONTRACT_PATH = TOOL_DIR / "inactive-playback-route-implementation-shadow-contract.json"
HS_PATH = TOOL_DIR / "InactivePlaybackRouteImplementationShadow.hs"
JS_PATH = TOOL_DIR / "inactive_playback_route_implementation_shadow_js.js"

REQUIRED_BUCKETS = [
    "accepted movie route",
    "accepted FTP mobile HLS route",
    "accepted local route",
    "accepted raw byte route",
    "accepted series route",
    "accepted live route",
    "missing id",
    "unsafe placeholder url",
    "method not allowed",
    "response body rejected",
    "status header rejected",
    "unknown route",
]
REQUIRED_ROUTE_TARGETS = [
    "/api/playback/movie",
    "/api/playback/ftp",
    "/api/playback/local",
    "/api/ftp/raw",
    "series episode playback",
    "live TV m3u8 playback",
]
REQUIRED_REASONS = [
    "OK",
    "PARTIAL_CONTENT",
    "MISSING_ID",
    "UNSAFE_PLACEHOLDER_URL",
    "METHOD_NOT_ALLOWED",
    "RESPONSE_BODY_REJECTED",
    "STATUS_HEADER_REJECTED",
    "UNKNOWN_ROUTE",
]


def report_path() -> Path:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    return TOOL_DIR / f"inactive-playback-route-implementation-shadow-fixture-coverage-report-{stamp}.txt"


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def url_failure(fixture: dict[str, Any]) -> str | None:
    value = str(fixture.get("streamUrl") or "")
    marker = json.dumps(fixture, sort_keys=True).lower()
    if "localhost" in value or "127.0.0.1" in value:
        return "localhost or loopback URL is forbidden"
    parsed = urlparse(value)
    if parsed.scheme == "local":
        return None
    if parsed.scheme == "placeholder":
        if "unsafe" not in marker:
            return "placeholder URL must be explicit unsafe coverage"
        return None
    if parsed.scheme in {"http", "https", "ftp"}:
        if not (parsed.hostname or "").endswith(".example.test"):
            return "network-like fixture host must end with .example.test"
        return None
    return f"unsupported fixture URL scheme: {value}"


def main() -> int:
    write_report = "--write-report" in sys.argv
    fixtures = load_json(FIXTURE_PATH)
    contract = load_json(CONTRACT_PATH)
    failures: list[str] = []

    if not isinstance(fixtures, list):
        failures.append("fixtures must be an array")
        fixtures = []
    if contract.get("contractId") != "inactive-playback-route-implementation-shadow-v1":
        failures.append("contractId mismatch")

    coverage: dict[str, list[str]] = {bucket: [] for bucket in REQUIRED_BUCKETS}
    route_targets: set[str] = set()
    reasons: set[str] = set()
    statuses: set[int] = set()
    for fixture in fixtures:
        if not isinstance(fixture, dict):
            failures.append("fixture entry must be an object")
            continue
        fixture_id = str(fixture.get("fixtureId") or "unknown")
        bucket = str(fixture.get("coverageBucket") or "")
        if bucket in coverage:
            coverage[bucket].append(fixture_id)
        route_targets.add(str(fixture.get("routeTarget") or ""))
        reasons.add(str(fixture.get("expectedReasonCode") or ""))
        status = fixture.get("expectedStatus")
        if isinstance(status, int):
            statuses.add(status)
        url_error = url_failure(fixture)
        if url_error:
            failures.append(f"{fixture_id}: {url_error}")

    missing_buckets = [bucket for bucket, fixture_ids in coverage.items() if not fixture_ids]
    missing_routes = [target for target in REQUIRED_ROUTE_TARGETS if target not in route_targets]
    missing_reasons = [reason for reason in REQUIRED_REASONS if reason not in reasons]
    failures.extend(f"missing coverage bucket: {bucket}" for bucket in missing_buckets)
    failures.extend(f"missing route target: {target}" for target in missing_routes)
    failures.extend(f"missing reason code: {reason}" for reason in missing_reasons)

    shadow_checks = {
        "haskell_exists": HS_PATH.exists(),
        "javascript_exists": JS_PATH.exists(),
        "haskell_shadow_banner": "INACTIVE SHADOW-ONLY ROUTE IMPLEMENTATION" in HS_PATH.read_text(encoding="utf-8", errors="ignore")
        if HS_PATH.exists()
        else False,
        "js_no_server_listen": "listen(" not in JS_PATH.read_text(encoding="utf-8", errors="ignore") if JS_PATH.exists() else False,
        "js_no_fetch": "fetch(" not in JS_PATH.read_text(encoding="utf-8", errors="ignore") if JS_PATH.exists() else False,
        "js_no_spawn": "spawn(" not in JS_PATH.read_text(encoding="utf-8", errors="ignore") if JS_PATH.exists() else False,
    }
    for label, passed in shadow_checks.items():
        if not passed:
            failures.append(f"shadow check failed: {label}")

    ok = not failures
    coverage_lines = [
        f"- {bucket}: {'present' if fixture_ids else 'missing'} fixtures={fixture_ids}"
        for bucket, fixture_ids in coverage.items()
    ]
    lines = [
        f"Status: {'PASS' if ok else 'FAIL'}",
        "mode: read-only inactive playback route implementation shadow fixture coverage audit",
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
        f"observed_statuses: {sorted(statuses)}",
        f"observed_route_targets: {sorted(route_targets)}",
        f"observed_reason_codes: {sorted(reasons)}",
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

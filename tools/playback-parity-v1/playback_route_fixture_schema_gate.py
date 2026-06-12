#!/usr/bin/env python3
"""Read-only playback route fixture schema gate."""

from __future__ import annotations

import json
import sys
from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
TOOL_DIR = ROOT / "tools" / "playback-parity-v1"
FIXTURE_PATH = TOOL_DIR / "playback-route-contract-fixtures.json"

CLIENT_TYPES = {"desktop", "mobile"}
SOURCE_TYPES = {"movie", "series", "live"}
PLAYBACK_MODES = {"direct", "hls", "live", "invalid"}
RISK_LEVELS = {"low", "medium", "high"}
RESPONSE_KINDS = {"json-only", "may-stream-bytes"}
ROUTE_TARGETS = {
    "/api/playback/local",
    "/api/playback/ftp",
    "/api/playback/movie",
    "/api/ftp/raw",
    "live TV m3u8 playback",
    "series episode playback",
}
STREAM_URL_PREFIXES = ("http://", "https://", "ftp://", "local://")
REQUIRED_KEYS = {
    "name",
    "routeTarget",
    "futureHaskellMirrorName",
    "riskLevel",
    "clientType",
    "sourceType",
    "streamUrl",
    "playbackMode",
    "requiresTranscode",
    "shouldUseFfmpeg",
    "responseKind",
    "expectedInputFields",
    "expectedOutputFields",
    "expectedValid",
}


def is_text(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())


def is_text_list(value: Any) -> bool:
    return isinstance(value, list) and bool(value) and all(is_text(item) for item in value)


def validate_fixture(fixture: dict[str, Any]) -> list[str]:
    failures: list[str] = []
    missing = sorted(REQUIRED_KEYS - set(fixture))
    if missing:
        failures.append(f"missing_keys:{','.join(missing)}")

    for key in ("name", "futureHaskellMirrorName"):
        if not is_text(fixture.get(key)):
            failures.append(f"missing_{key}")
    if not is_text(fixture.get("routeTarget")):
        failures.append("missing_routeTarget")
    elif fixture.get("routeTarget") not in ROUTE_TARGETS:
        failures.append("invalid_routeTarget")
    if fixture.get("riskLevel") not in RISK_LEVELS:
        failures.append("invalid_riskLevel")
    if not is_text(fixture.get("clientType")):
        failures.append("missing_clientType")
    elif fixture.get("clientType") not in CLIENT_TYPES:
        failures.append("invalid_clientType")
    if not is_text(fixture.get("sourceType")):
        failures.append("missing_sourceType")
    elif fixture.get("sourceType") not in SOURCE_TYPES:
        failures.append("invalid_sourceType")
    if fixture.get("playbackMode") not in PLAYBACK_MODES:
        failures.append("invalid_playbackMode")
    if not isinstance(fixture.get("requiresTranscode"), bool):
        failures.append("invalid_requiresTranscode")
    if not isinstance(fixture.get("shouldUseFfmpeg"), bool):
        failures.append("invalid_shouldUseFfmpeg")
    if fixture.get("responseKind") not in RESPONSE_KINDS:
        failures.append("invalid_responseKind")
    if not is_text_list(fixture.get("expectedInputFields")):
        failures.append("missing_expectedInputFields")
    if not is_text_list(fixture.get("expectedOutputFields")):
        failures.append("missing_expectedOutputFields")
    if not isinstance(fixture.get("expectedValid"), bool):
        failures.append("invalid_expectedValid")

    stream_url = str(fixture.get("streamUrl") or "").strip()
    expected_valid = fixture.get("expectedValid") is True
    if not stream_url:
        failures.append("missing_streamUrl")
    if expected_valid and not stream_url:
        failures.append("valid_fixture_missing_streamUrl")
    if not expected_valid:
        if not is_text(fixture.get("expectedFailureBucket")):
            failures.append("invalid_fixture_missing_expectedFailureBucket")
        if not is_text(fixture.get("invalidReason")):
            failures.append("invalid_fixture_missing_invalidReason")

    if stream_url:
        lowered = stream_url.lower()
        if not lowered.startswith(STREAM_URL_PREFIXES):
            failures.append("invalid_unsafe_streamUrl")
        if fixture.get("routeTarget") == "/api/ftp/raw" and not lowered.startswith("ftp://"):
            failures.append("ftp_raw_not_ftp_url")
        if fixture.get("routeTarget") == "/api/playback/local" and not lowered.startswith("local://"):
            failures.append("local_route_not_local_url")
        if fixture.get("sourceType") == "live" and ".m3u8" not in lowered:
            failures.append("live_missing_m3u8_streamUrl")

    if fixture.get("sourceType") == "live" and fixture.get("playbackMode") != "live":
        failures.append("live_not_live_playbackMode")
    if fixture.get("playbackMode") == "hls" and fixture.get("clientType") != "mobile":
        failures.append("hls_fixture_not_mobile")
    if fixture.get("playbackMode") == "direct" and fixture.get("requiresTranscode") is True:
        failures.append("direct_requires_transcode")
    if fixture.get("clientType") == "desktop" and fixture.get("shouldUseFfmpeg") is True:
        failures.append("desktop_forces_ffmpeg")
    if fixture.get("clientType") == "desktop" and fixture.get("playbackMode") == "hls":
        failures.append("desktop_forces_hls")
    if fixture.get("clientType") == "mobile" and fixture.get("requiresTranscode") is True:
        if fixture.get("playbackMode") != "hls" or fixture.get("shouldUseFfmpeg") is not True:
            failures.append("mobile_transcode_without_hls_ffmpeg")

    return failures


def report_path() -> Path:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    return TOOL_DIR / f"playback-route-fixture-schema-report-{stamp}.txt"


def main() -> int:
    write_report = "--write-report" in sys.argv
    fixtures = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
    if not isinstance(fixtures, list):
        raise SystemExit("Fixture file must contain a JSON array")

    names = [fixture.get("name") for fixture in fixtures if isinstance(fixture, dict)]
    duplicate_names = sorted(name for name, count in Counter(names).items() if name and count > 1)
    unexpected: list[str] = [f"duplicate fixture id/name: {name}" for name in duplicate_names]
    coverage: Counter[str] = Counter()
    fixture_lines: list[str] = []

    for index, fixture in enumerate(fixtures):
        if not isinstance(fixture, dict):
            unexpected.append(f"fixtures[{index}] is not an object")
            continue
        failures = validate_fixture(fixture)
        expected_valid = fixture.get("expectedValid") is True
        actual_valid = not failures
        expected_failure = str(fixture.get("expectedFailureBucket") or "").strip()
        if expected_valid and not actual_valid:
            unexpected.append(f"{fixture.get('name')}: expected valid but failed {failures}")
        if not expected_valid:
            if actual_valid:
                unexpected.append(f"{fixture.get('name')}: expected invalid but passed")
            elif expected_failure and expected_failure not in failures:
                unexpected.append(f"{fixture.get('name')}: expected failure {expected_failure} but saw {failures}")

        if fixture.get("playbackMode") == "direct":
            coverage["direct"] += 1
        if fixture.get("playbackMode") == "hls":
            coverage["hls"] += 1
        if fixture.get("playbackMode") == "live":
            coverage["live"] += 1
        if fixture.get("routeTarget") == "/api/ftp/raw" or fixture.get("responseKind") == "may-stream-bytes":
            coverage["raw_or_streaming"] += 1
        if fixture.get("routeTarget") == "/api/playback/local" or str(fixture.get("streamUrl") or "").startswith("local://"):
            coverage["local"] += 1

        fixture_lines.append(
            f"- {fixture.get('name')}: routeTarget={fixture.get('routeTarget')} "
            f"clientType={fixture.get('clientType')} sourceType={fixture.get('sourceType')} "
            f"playbackMode={fixture.get('playbackMode')} responseKind={fixture.get('responseKind')} "
            f"expectedValid={expected_valid} actualSchemaValid={actual_valid} failures={failures}"
        )

    required_coverage = {"direct", "hls", "live", "raw_or_streaming", "local"}
    missing_coverage = sorted(item for item in required_coverage if coverage[item] == 0)
    if missing_coverage:
        unexpected.append(f"missing required fixture coverage: {missing_coverage}")

    ok = not unexpected
    lines = [
        f"Status: {'PASS' if ok else 'FAIL'}",
        "mode: read-only playback route fixture schema gate",
        "server_started: no",
        "network_called: no",
        "runtime_playback_changed: no",
        "active_routes_added: no",
        f"fixture_path: {FIXTURE_PATH.relative_to(ROOT)}",
        f"fixture_count: {len(fixtures)}",
        f"duplicate_fixture_names: {duplicate_names}",
        f"coverage_counts: {dict(sorted(coverage.items()))}",
        f"missing_coverage: {missing_coverage}",
        "fixtures:",
        *fixture_lines,
        f"unexpected_results: {unexpected}",
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

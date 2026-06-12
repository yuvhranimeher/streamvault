#!/usr/bin/env python3
"""Read-only playback planner fixture schema gate."""

from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
FIXTURE_PATH = ROOT / "tools" / "playback-parity-v1" / "playback-planner-fixtures.json"
REPORT_PATH = ROOT / "tools" / "playback-parity-v1" / "playback-planner-fixture-schema-report-20260612-100033.txt"

REQUIRED_KEYS = {
    "name",
    "expectedValid",
    "input",
    "clientType",
    "streamUrl",
    "playbackMode",
    "requiresTranscode",
    "shouldUseFfmpeg",
    "reason",
    "sourceType",
}
INPUT_KEYS = {"title", "id", "type"}
CLIENT_TYPES = {"desktop", "mobile"}
PLAYBACK_MODES = {"direct", "hls", "live"}
SOURCE_TYPES = {"movie", "series", "live"}


def is_text(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())


def validate_fixture(item: dict[str, Any]) -> list[str]:
    failures: list[str] = []
    missing = sorted(REQUIRED_KEYS - set(item))
    if missing:
        failures.append(f"missing_keys:{','.join(missing)}")
    input_obj = item.get("input")
    if not isinstance(input_obj, dict):
        failures.append("invalid_input_object")
        input_obj = {}
    missing_input = sorted(INPUT_KEYS - set(input_obj))
    if missing_input:
        failures.append(f"missing_input_keys:{','.join(missing_input)}")
    for key in INPUT_KEYS:
        if not is_text(input_obj.get(key)):
            failures.append(f"invalid_input_{key}")

    if item.get("clientType") not in CLIENT_TYPES:
        failures.append("invalid_clientType")
    if item.get("playbackMode") not in PLAYBACK_MODES:
        failures.append("unknown_playbackMode")
    if item.get("sourceType") not in SOURCE_TYPES:
        failures.append("invalid_sourceType")
    if not isinstance(item.get("requiresTranscode"), bool):
        failures.append("invalid_requiresTranscode")
    if not isinstance(item.get("shouldUseFfmpeg"), bool):
        failures.append("invalid_shouldUseFfmpeg")
    if not is_text(item.get("reason")):
        failures.append("missing_reason")

    stream_url = str(item.get("streamUrl") or "").strip()
    if not stream_url:
        failures.append("missing_streamUrl")
    if item.get("sourceType") == "live":
        if item.get("playbackMode") != "live":
            failures.append("live_not_live_mode")
        if stream_url and ".m3u8" not in stream_url.lower():
            failures.append("live_missing_m3u8")
    if item.get("clientType") == "desktop" and item.get("shouldUseFfmpeg") is True:
        failures.append("desktop_forces_ffmpeg")
    if item.get("clientType") == "desktop" and item.get("playbackMode") == "hls" and item.get("sourceType") != "live":
        failures.append("desktop_forces_hls")
    if item.get("clientType") == "mobile" and item.get("requiresTranscode") and item.get("playbackMode") != "hls":
        failures.append("mobile_transcode_without_hls")
    if item.get("playbackMode") == "direct" and item.get("requiresTranscode"):
        failures.append("direct_requires_transcode")
    return failures


def main() -> int:
    write_report = "--write-report" in sys.argv
    fixtures = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
    if not isinstance(fixtures, list):
        raise SystemExit("Fixture file must contain a JSON array")

    required_names = {
        "desktop_movie_direct_ftp",
        "mobile_movie_hls_required",
        "series_episode_direct",
        "live_tv_hls_m3u8",
        "invalid_missing_streamUrl",
    }
    names = [item.get("name") for item in fixtures if isinstance(item, dict)]
    missing_required = sorted(required_names - set(names))
    duplicate_names = sorted(name for name, count in Counter(names).items() if name and count > 1)

    report_lines: list[str] = []
    unexpected: list[str] = []
    bucket_counts: Counter[str] = Counter()
    for index, fixture in enumerate(fixtures):
        if not isinstance(fixture, dict):
            unexpected.append(f"fixture[{index}] is not an object")
            continue
        failures = validate_fixture(fixture)
        for failure in failures:
            bucket_counts[failure] += 1
        expected_valid = fixture.get("expectedValid") is True
        expected_failure = str(fixture.get("expectedFailureBucket") or "").strip()
        actual_valid = not failures
        if expected_valid and not actual_valid:
            unexpected.append(f"{fixture.get('name')}: expected valid but failed {failures}")
        if not expected_valid:
            if actual_valid:
                unexpected.append(f"{fixture.get('name')}: expected invalid but passed")
            elif expected_failure and expected_failure not in failures:
                unexpected.append(f"{fixture.get('name')}: expected failure {expected_failure} but saw {failures}")
        report_lines.append(
            f"- {fixture.get('name', f'fixture_{index}')}: expectedValid={expected_valid} "
            f"actualValid={actual_valid} clientType={fixture.get('clientType')} "
            f"sourceType={fixture.get('sourceType')} playbackMode={fixture.get('playbackMode')} "
            f"requiresTranscode={fixture.get('requiresTranscode')} shouldUseFfmpeg={fixture.get('shouldUseFfmpeg')} "
            f"failures={failures}"
        )

    if missing_required:
        unexpected.append(f"missing required fixture names: {missing_required}")
    if duplicate_names:
        unexpected.append(f"duplicate fixture names: {duplicate_names}")

    ok = not unexpected
    lines = [
        f"Status: {'PASS' if ok else 'FAIL'}",
        "mode: read-only playback planner fixture schema gate",
        "server_started: no",
        "media_sources_called: no",
        "runtime_playback_changed: no",
        f"fixture_count: {len(fixtures)}",
        f"required_fixture_names: {sorted(required_names)}",
        f"missing_required_fixture_names: {missing_required}",
        f"duplicate_fixture_names: {duplicate_names}",
        f"allowed_client_types: {sorted(CLIENT_TYPES)}",
        f"allowed_playback_modes: {sorted(PLAYBACK_MODES)}",
        f"allowed_source_types: {sorted(SOURCE_TYPES)}",
        f"failure_bucket_counts: {dict(sorted(bucket_counts.items()))}",
        "fixtures:",
        *report_lines,
        f"unexpected_results: {unexpected}",
        "contract_notes:",
        "- Desktop direct fixtures must not require FFmpeg or HLS.",
        "- Mobile HLS fixtures may require FFmpeg only when compatibility requires HLS.",
        "- Live fixtures must remain m3u8/live-mode and must not rewrite production URLs.",
    ]
    output = "\n".join(lines) + "\n"
    if write_report:
        REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
        REPORT_PATH.write_text(output, encoding="utf-8")
    sys.stdout.write(output)
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())

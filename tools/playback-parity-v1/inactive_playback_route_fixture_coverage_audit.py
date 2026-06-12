#!/usr/bin/env python3
"""Audit inactive playback route fixture coverage against the frozen route contract."""

from __future__ import annotations

import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Callable


ROOT = Path(__file__).resolve().parents[2]
TOOL_DIR = ROOT / "tools" / "playback-parity-v1"
FIXTURE_PATH = TOOL_DIR / "playback-route-contract-fixtures.json"
INVENTORY_PATH = TOOL_DIR / "playback-route-shadow-contract-inventory.json"
INACTIVE_HS_PATH = TOOL_DIR / "InactivePlaybackRouteV1.hs"

CoverageCheck = Callable[[dict[str, Any]], bool]


def report_path() -> Path:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    return TOOL_DIR / f"inactive-playback-route-fixture-coverage-report-{stamp}.txt"


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def text(value: Any) -> str:
    return str(value or "")


def valid(fixture: dict[str, Any]) -> bool:
    return fixture.get("expectedValid") is True


def invalid_bucket(bucket: str) -> CoverageCheck:
    return lambda fixture: fixture.get("expectedValid") is False and fixture.get("expectedFailureBucket") == bucket


REQUIRED_COVERAGE: list[tuple[str, CoverageCheck]] = [
    (
        "desktop movie direct",
        lambda fixture: valid(fixture)
        and fixture.get("clientType") == "desktop"
        and fixture.get("sourceType") == "movie"
        and fixture.get("playbackMode") == "direct"
        and fixture.get("routeTarget") == "/api/playback/ftp",
    ),
    (
        "mobile movie HLS",
        lambda fixture: valid(fixture)
        and fixture.get("clientType") == "mobile"
        and fixture.get("sourceType") == "movie"
        and fixture.get("playbackMode") == "hls",
    ),
    (
        "desktop series episode direct",
        lambda fixture: valid(fixture)
        and fixture.get("clientType") == "desktop"
        and fixture.get("sourceType") == "series"
        and fixture.get("playbackMode") == "direct",
    ),
    (
        "mobile series episode HLS",
        lambda fixture: valid(fixture)
        and fixture.get("clientType") == "mobile"
        and fixture.get("sourceType") == "series"
        and fixture.get("playbackMode") == "hls",
    ),
    (
        "FTP raw stream metadata",
        lambda fixture: valid(fixture) and fixture.get("routeTarget") == "/api/ftp/raw",
    ),
    (
        "local file playback metadata",
        lambda fixture: valid(fixture) and fixture.get("routeTarget") == "/api/playback/local",
    ),
    (
        "live TV HLS contract",
        lambda fixture: valid(fixture)
        and fixture.get("sourceType") == "live"
        and fixture.get("playbackMode") == "live"
        and ".m3u8" in text(fixture.get("streamUrl")),
    ),
    ("invalid missing streamUrl", invalid_bucket("missing_streamUrl")),
    ("invalid unknown route", invalid_bucket("invalid_routeTarget")),
    ("invalid unsupported clientType", invalid_bucket("invalid_clientType")),
    ("invalid unsupported sourceType", invalid_bucket("invalid_sourceType")),
    ("invalid unsafe/non-http streamUrl", invalid_bucket("invalid_unsafe_streamUrl")),
    ("invalid missing route target", invalid_bucket("missing_routeTarget")),
    ("invalid missing sourceType", invalid_bucket("missing_sourceType")),
    ("invalid missing clientType", invalid_bucket("missing_clientType")),
]


def matching_names(fixtures: list[dict[str, Any]], check: CoverageCheck) -> list[str]:
    return [text(fixture.get("name")) for fixture in fixtures if check(fixture)]


def main() -> int:
    write_report = "--write-report" in sys.argv
    failures: list[str] = []

    fixtures_raw = load_json(FIXTURE_PATH)
    inventory_raw = load_json(INVENTORY_PATH)
    inactive_text = INACTIVE_HS_PATH.read_text(encoding="utf-8") if INACTIVE_HS_PATH.exists() else ""

    if not isinstance(fixtures_raw, list):
        raise SystemExit("Fixture file must contain a JSON array")
    if not isinstance(inventory_raw, dict) or not isinstance(inventory_raw.get("contracts"), list):
        raise SystemExit("Inventory must contain a contracts array")

    fixtures = [fixture for fixture in fixtures_raw if isinstance(fixture, dict)]
    inventory_targets = [
        text(contract.get("target"))
        for contract in inventory_raw["contracts"]
        if isinstance(contract, dict) and text(contract.get("target"))
    ]

    coverage_lines: list[str] = []
    for label, check in REQUIRED_COVERAGE:
        names = matching_names(fixtures, check)
        if not names:
            failures.append(f"missing fixture coverage: {label}")
        coverage_lines.append(f"- {label}: {'present' if names else 'missing'} fixtures={names}")

    required_inventory_targets = {
        "/api/playback/local",
        "/api/playback/ftp",
        "/api/playback/movie",
        "/api/ftp/raw",
        "live TV m3u8 playback",
        "series episode playback",
    }
    missing_inventory_targets = sorted(required_inventory_targets - set(inventory_targets))
    if missing_inventory_targets:
        failures.append(f"inventory missing route targets: {missing_inventory_targets}")

    inactive_checks = {
        "exists": INACTIVE_HS_PATH.exists(),
        "shadow_only_banner": "INACTIVE SHADOW-ONLY ROUTE IMPLEMENTATION" in inactive_text,
        "missing_route_target_guard": "Missing routeTarget" in inactive_text,
        "unsupported_client_guard": "Unsupported clientType" in inactive_text,
        "unsupported_source_guard": "Unsupported sourceType" in inactive_text,
        "unsafe_stream_guard": "Unsafe streamUrl" in inactive_text,
        "no_server_start": "listen" not in inactive_text,
        "no_ffmpeg": "ffmpeg" not in inactive_text.lower() or "not start a server, call the network, call FFmpeg" in inactive_text,
    }
    for label, passed in inactive_checks.items():
        if not passed:
            failures.append(f"inactive Haskell check failed: {label}")

    ok = not failures
    lines = [
        f"Status: {'PASS' if ok else 'FAIL'}",
        "mode: read-only inactive playback route fixture coverage audit",
        "server_started: no",
        "network_called: no",
        "ffmpeg_started: no",
        "runtime_playback_changed: no",
        "active_routes_added: no",
        "inactive_route_wired: no",
        f"fixture_path: {FIXTURE_PATH.relative_to(ROOT)}",
        f"inventory_path: {INVENTORY_PATH.relative_to(ROOT)}",
        f"inactive_haskell: {INACTIVE_HS_PATH.relative_to(ROOT)}",
        f"fixture_count: {len(fixtures)}",
        f"inventory_targets: {inventory_targets}",
        f"missing_inventory_targets: {missing_inventory_targets}",
        "coverage:",
        *coverage_lines,
        f"inactive_haskell_checks: {inactive_checks}",
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

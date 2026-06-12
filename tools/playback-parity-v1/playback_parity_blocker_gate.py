#!/usr/bin/env python3
"""Read-only playback parity blocker gate.

Fails only for current contract risks that would make shadow playback planning
unsafe. Known future migration blockers are reported but do not fail the gate
unless they violate the present read-only contract.
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
BASE_BRANCH = "haskell-deep-parity-batch-20260612-092756"
FIXTURE_PATH = ROOT / "tools" / "playback-parity-v1" / "playback-planner-fixtures.json"
REPORT_PATH = ROOT / "tools" / "playback-parity-v1" / "playback-parity-blocker-report-20260612-100033.txt"
PLAYBACK_MODES = {"direct", "hls", "live"}
RUNTIME_PREFIXES = (
    "server.js",
    "public/",
    "routes/",
    "lib/",
    "package.json",
    "package-lock.json",
)
ALLOWED_CHANGE_PREFIXES = (
    "tools/playback-parity-v1/",
)


def read_text(relative_path: str) -> str:
    path = ROOT / relative_path
    return path.read_text(encoding="utf-8") if path.exists() else ""


def git_lines(args: list[str]) -> list[str]:
    try:
        result = subprocess.run(
            ["git", *args],
            cwd=ROOT,
            check=False,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
    except OSError:
        return []
    return [line.strip() for line in result.stdout.splitlines() if line.strip()]


def route_present(server: str, route: str) -> bool:
    return bool(re.search(r"app\.(?:get|post)\([^)]*" + re.escape(route), server))


def load_fixtures() -> list[dict[str, Any]]:
    data = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
    return [item for item in data if isinstance(item, dict)]


def branch_changed_files() -> list[str]:
    return git_lines(["diff", "--name-only", f"{BASE_BRANCH}...HEAD"])


def working_tree_changed_files() -> list[str]:
    lines = git_lines(["status", "--short"])
    files = []
    for line in lines:
        files.append(line[3:] if len(line) > 3 else line)
    return files


def unsafe_runtime_changes() -> list[str]:
    changed = set(branch_changed_files())
    changed.update(working_tree_changed_files())
    unsafe = []
    for path in sorted(changed):
        if path.startswith(ALLOWED_CHANGE_PREFIXES):
            continue
        if path.startswith(RUNTIME_PREFIXES):
            unsafe.append(path)
    return unsafe


def fixture_by_name(fixtures: list[dict[str, Any]], name: str) -> dict[str, Any] | None:
    for fixture in fixtures:
        if fixture.get("name") == name:
            return fixture
    return None


def main() -> int:
    write_report = "--write-report" in sys.argv
    app = read_text("public/app.js")
    server = read_text("server.js")
    channels = read_text("channels.json")
    fixtures = load_fixtures()

    real_risks: list[str] = []
    reported_blockers: list[str] = []

    desktop_fixture = fixture_by_name(fixtures, "desktop_movie_direct_ftp")
    mobile_fixture = fixture_by_name(fixtures, "mobile_movie_hls_required")
    series_fixture = fixture_by_name(fixtures, "series_episode_direct")
    live_fixture = fixture_by_name(fixtures, "live_tv_hls_m3u8")
    invalid_fixture = fixture_by_name(fixtures, "invalid_missing_streamUrl")

    if "function desktopFtpPlaybackSrc(url)" not in app:
        real_risks.append("desktop path missing desktopFtpPlaybackSrc")
    if "if(!isMobilePlaybackClient())" not in app:
        real_risks.append("desktop/mobile branch missing around FTP playback")
    if "Desktop performance mode kept FFmpeg off" not in app:
        real_risks.append("desktop FFmpeg-off guard message missing")
    if desktop_fixture and desktop_fixture.get("shouldUseFfmpeg") is True:
        real_risks.append("desktop fixture forces FFmpeg")
    if desktop_fixture and desktop_fixture.get("playbackMode") != "direct":
        real_risks.append("desktop fixture is not direct mode")

    if "function isMobilePlaybackClient()" not in app:
        real_risks.append("mobile client detector missing")
    if "/api/mobile-hls/ftp/index.m3u8" not in server:
        real_risks.append("mobile FTP HLS route missing")
    if "/api/mobile-hls/local/:id/index.m3u8" not in server:
        real_risks.append("mobile local HLS route missing")
    if mobile_fixture and mobile_fixture.get("requiresTranscode") and mobile_fixture.get("playbackMode") != "hls":
        real_risks.append("mobile HLS-required fixture does not use hls mode")

    if "async function playFtpMedia(streamUrl" not in app:
        real_risks.append("playFtpMedia streamUrl entrypoint missing")
    if "function resolveFtpPlayUrl(streamUrl)" not in app:
        real_risks.append("direct streamUrl resolver missing")
    if desktop_fixture and not str(desktop_fixture.get("streamUrl") or "").strip():
        real_risks.append("desktop direct fixture missing streamUrl")
    if series_fixture and not str(series_fixture.get("streamUrl") or "").strip():
        real_risks.append("series direct fixture missing streamUrl")

    if "app.get('/live/:channelId/playlist.m3u8'" not in server:
        real_risks.append("live TV m3u8 route missing")
    if live_fixture and (live_fixture.get("playbackMode") != "live" or ".m3u8" not in str(live_fixture.get("streamUrl") or "")):
        real_risks.append("live TV fixture does not represent live m3u8 mode")
    if "m3u8" not in channels.lower():
        real_risks.append("channels.json does not represent m3u8 live sources")

    unknown_modes = sorted({str(item.get("playbackMode")) for item in fixtures if item.get("playbackMode") not in PLAYBACK_MODES})
    if unknown_modes:
        real_risks.append(f"unknown playback modes in fixtures: {unknown_modes}")
    if invalid_fixture and invalid_fixture.get("expectedValid") is not False:
        real_risks.append("missing-stream fixture is not marked expected invalid")
    if invalid_fixture and str(invalid_fixture.get("streamUrl") or "").strip():
        real_risks.append("missing-stream fixture unexpectedly has streamUrl")

    unsafe_changes = unsafe_runtime_changes()
    if unsafe_changes:
        real_risks.append(f"unsafe production runtime modifications detected: {unsafe_changes}")

    frontend_server_mismatches = [
        ("/api/playback/local", "/api/playback/local/" in app, route_present(server, "/api/playback/local")),
        ("/api/playback/ftp", "/api/playback/ftp?" in app, route_present(server, "/api/playback/ftp")),
        ("/api/playback/movie", "/api/playback/movie/" in app, route_present(server, "/api/playback/movie")),
        ("/api/ftp/raw", "/api/ftp/raw?url=" in app, route_present(server, "/api/ftp/raw")),
    ]
    for route, frontend_ref, server_route in frontend_server_mismatches:
        if frontend_ref and not server_route:
            reported_blockers.append(f"{route}: frontend reference exists but JS server route is absent on this branch")

    ok = not real_risks
    lines = [
        f"Status: {'PASS' if ok else 'FAIL'}",
        "mode: read-only playback parity blocker gate",
        "server_started: no",
        "media_sources_called: no",
        "ffmpeg_started: no",
        "runtime_playback_changed: no",
        "fail_only_on_real_contract_risks: true",
        "contract_checks:",
        f"- desktop_path_forces_ffmpeg: {'FAIL' if any('desktop' in risk and 'FFmpeg' in risk for risk in real_risks) else 'PASS'}",
        f"- mobile_path_has_hls_plan: {'PASS' if not any('mobile' in risk and 'HLS' in risk for risk in real_risks) else 'FAIL'}",
        f"- direct_streamUrl_handling: {'PASS' if not any('streamUrl' in risk for risk in real_risks) else 'FAIL'}",
        f"- live_tv_m3u8_represented: {'PASS' if not any('live TV' in risk or 'channels.json' in risk for risk in real_risks) else 'FAIL'}",
        f"- unknown_playback_mode: {'FAIL' if unknown_modes else 'PASS'}",
        f"- unsafe_runtime_modification: {'FAIL' if unsafe_changes else 'PASS'}",
        f"runtime_diff_checked_against: {BASE_BRANCH}",
        f"unsafe_runtime_changes: {unsafe_changes}",
        f"real_contract_risks: {real_risks}",
        "reported_future_blockers:",
        *([f"- {item}" for item in reported_blockers] if reported_blockers else ["- none"]),
        "remaining_policy:",
        "- Do not implement playback routes yet.",
        "- Keep desktop direct-play original FTP/HTTP behavior out of FFmpeg.",
        "- Keep mobile HLS limited to required compatibility cases.",
    ]
    output = "\n".join(lines) + "\n"
    if write_report:
        REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
        REPORT_PATH.write_text(output, encoding="utf-8")
    sys.stdout.write(output)
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())

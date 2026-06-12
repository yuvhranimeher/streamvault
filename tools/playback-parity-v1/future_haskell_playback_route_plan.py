#!/usr/bin/env python3
"""Read-only future Haskell playback route plan report."""

from __future__ import annotations

import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
REPORT_PATH = ROOT / "tools" / "playback-parity-v1" / "future-haskell-playback-route-plan-20260612-100033.txt"


def main() -> int:
    write_report = "--write-report" in sys.argv
    lines = [
        "Status: PASS",
        "mode: read-only future Haskell playback route plan",
        "server_started: no",
        "media_sources_called: no",
        "ffmpeg_started: no",
        "runtime_playback_changed: no",
        "implementation_stop_line: Do not implement playback route yet.",
        "implementation_prerequisite: Build shadow-only planner first.",
        "future_route_names:",
        "- /api/playback/shadow/plan: pure planner comparison endpoint; low risk; no media fetch.",
        "- /api/playback/shadow/ftp: future mirror for FTP/HTTP remote source decisions; medium risk; no proxying.",
        "- /api/playback/shadow/local/:id: future mirror for local library source decisions; medium risk; no streaming.",
        "- /api/playback/shadow/live/:channelId: future mirror for live m3u8 planner decisions; high risk; no playlist fetch.",
        "- /api/playback/shadow/fixtures: fixture-only contract endpoint; low risk; returns checked fixture plans.",
        "- /api/playback/ftp: eventual production planner route only after shadow parity; high risk.",
        "- /api/playback/local/:id: eventual production planner route only after shadow parity; high risk.",
        "- /api/playback/movie/:id: eventual hydrator/planner bridge only after details parity; medium risk.",
        "- /api/play-url: legacy compatibility mirror only after planner parity; medium risk.",
        "- /api/mobile-hls/*: do not port until planner parity, process lifecycle, cleanup, and FFmpeg tests exist; critical risk.",
        "- /api/ftp/proxy and /api/ftp/stream: do not port until desktop direct-play and mobile-HLS gates are green; critical risk.",
        "expected_json_contracts:",
        "- common request: { input:{title,id,type}, clientType, sourceType, streamUrl, requestedStart, audioTrack, subtitleTrack }",
        "- common response: { ok, input, clientType, sourceType, streamUrl, playbackMode, requiresTranscode, shouldUseFfmpeg, reason }",
        "- direct response fields: { finalPlayUrl, proxyUrl, directPlayable, rangeMode, preservesOriginalQuality }",
        "- hls response fields: { hlsUrl, sessionScope, sessionKey, ffmpegProfile, cleanupPolicy, reason }",
        "- live response fields: { playlistUrl, channelId, sourceUrlPreserved, proxyMode, reason }",
        "- error response fields: { ok:false, code, message, input, missingFields, safeToRetry }",
        "danger_risk_levels:",
        "- low: fixture-only planner, parser-only URL builder, static route inventory.",
        "- medium: shadow local/FTP planner that returns JSON only.",
        "- high: planner endpoints consumed by frontend, live m3u8 planning, play-url compatibility.",
        "- critical: mobile HLS sessions, FTP proxy/stream, FFmpeg process lifecycle, subtitle extraction, live segment proxy.",
        "safe_migration_order:",
        "- 1. Keep Python fixture/schema/blocker gates passing.",
        "- 2. Add a Haskell pure planner module that reads fixture JSON and emits JSON only.",
        "- 3. Compare Haskell pure planner output with the fixture schema; no server route.",
        "- 4. Add a shadow-only Haskell CLI/gate for desktop direct, mobile HLS-required, series episode, live, and invalid fixtures.",
        "- 5. Add a shadow-only HTTP route only after CLI parity passes, hidden from frontend.",
        "- 6. Add JS-vs-Haskell shadow comparison reports; do not route production traffic.",
        "- 7. Only after repeated green gates, design an opt-in non-default planner endpoint.",
        "- 8. Leave /api/mobile-hls/*, /api/ftp/proxy, /api/ftp/stream, and live segment proxy until last.",
        "test_strategy:",
        "- Python gates validate fixture schema, source inventory, behavior references, and blocker conditions.",
        "- Node validation may run extractor-only tests if Node is available; do not start the production server.",
        "- Haskell validation should compile a pure planner module only; no sockets, no FFmpeg, no URL fetch.",
        "- Golden fixtures must include desktop direct FTP, HTTP direct/proxy, mobile HLS-required, live m3u8, series episode, and missing streamUrl.",
        "- Negative tests must reject unknown playbackMode, desktop FFmpeg forcing, live non-m3u8, and missing streamUrl.",
        "- Regression tests must assert desktop direct-play original FTP and no automatic desktop transcoding.",
        "must_preserve:",
        "- desktop direct-play original FTP",
        "- mobile HLS only when required",
        "- no automatic desktop transcoding",
        "- no forced FFmpeg on desktop",
        "- live TV playlist/segment behavior",
        "- downloads redirect behavior",
        "- poster cache behavior",
    ]
    output = "\n".join(lines) + "\n"
    if write_report:
        REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
        REPORT_PATH.write_text(output, encoding="utf-8")
    sys.stdout.write(output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""Read-only playback migration readiness audit.

This script records the playback invariants that any Haskell migration must
preserve. It does not start the server, touch routes, call media sources, or
change production playback behavior.
"""

from __future__ import annotations

import shutil
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
REPORT_PATH = ROOT / "tools" / "playback-parity-v1" / "playback-readiness-report-20260612-001656.txt"

FRONTEND_TOKENS = {
    "mobile_client_detector": "function isMobilePlaybackClient()",
    "ftp_player_entry": "async function playFtpMedia(",
    "desktop_ftp_source_selector": "function desktopFtpPlaybackSrc(url)",
    "desktop_ftp_raw": "return ftpRawSrc(value)",
    "desktop_ftp_proxy": "return ftpProxySrc(value)",
    "desktop_ffmpeg_off_notice": "Desktop performance mode kept FFmpeg off",
    "desktop_quality_original_only": "Desktop performance mode streams original quality only",
    "desktop_seek_original_stream": "Desktop performance mode seeks on the original stream without FFmpeg.",
    "mobile_hls_plan_flag": "if(isMobilePlaybackClient())params.set('mobile','1')",
    "ftp_plan_fetch": "async function fetchFtpPlaybackPlan(",
    "ftp_transcode_src_helper": "function ftpTranscodeSrc(",
}

SERVER_TOKENS = {
    "mobile_request_detector": "function isMobilePlaybackRequest(req)",
    "mobile_hls_ftp_route": "app.get('/api/mobile-hls/ftp/index.m3u8'",
    "mobile_hls_local_route": "app.get('/api/mobile-hls/local/:id/index.m3u8'",
    "mobile_hls_segment_route": "app.get('/api/mobile-hls/:scope/:key/:file'",
    "ftp_proxy_route": "app.get('/api/ftp/proxy'",
    "ftp_stream_route": "app.get('/api/ftp/stream'",
    "play_url_route": "app.get('/api/play-url'",
    "remote_play_urls": "function remotePlayUrls(",
    "direct_playable_field": "directPlayable",
    "mobile_hls_profile": "MOBILE_HLS_PROFILE",
}


def read_text(relative_path: str) -> str:
    return (ROOT / relative_path).read_text(encoding="utf-8")


def main() -> int:
    write_report = "--write-report" in sys.argv
    frontend = "\n".join(
        read_text(path)
        for path in ["public/app.js", "public/player.js", "public/boot.js"]
        if (ROOT / path).exists()
    )
    server = read_text("server.js")

    missing_frontend = [name for name, token in FRONTEND_TOKENS.items() if token not in frontend]
    missing_server = [name for name, token in SERVER_TOKENS.items() if token not in server]
    ok = not missing_frontend and not missing_server

    lines = [
        f"Status: {'PASS' if ok else 'FAIL'}",
        "mode: read-only playback migration readiness audit",
        "server_started: no",
        "media_sources_called: no",
        "production_playback_routes_changed: no",
        "desktop_direct_play_original_ftp: preserve",
        "mobile_hls_only_when_required: preserve",
        "automatic_desktop_transcoding: forbidden",
        "desktop_extra_audio_track_transcoding: forbidden",
        "runtime_change_scope: none; audit/report only",
        f"node_available: {str(shutil.which('node') is not None).lower()}",
        f"ghc_available: {str(shutil.which('ghc') is not None).lower()}",
        f"cabal_available: {str(shutil.which('cabal') is not None).lower()}",
        f"missing_frontend_tokens: {missing_frontend}",
        f"missing_server_tokens: {missing_server}",
        "migration_notes:",
        "- Haskell playback planning must not force desktop FTP URLs through HLS or FFmpeg.",
        "- Desktop should keep original FTP/HTTP media via raw/proxy direct-play paths.",
        "- Mobile may use HLS/remux/transcode only when browser compatibility requires it.",
        "- Live TV playlist and segment proxy behavior is out of scope for route changes in this batch.",
    ]

    output = "\n".join(lines) + "\n"
    if write_report:
        REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
        REPORT_PATH.write_text(output, encoding="utf-8")
    sys.stdout.write(output)
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())

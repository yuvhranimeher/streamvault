#!/usr/bin/env python3
"""Read-only playback source inventory report.

Scans the current JavaScript playback surface and writes a concise migration
inventory. It does not start the server, call media URLs, run FFmpeg, or change
runtime behavior.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
REPORT_PATH = ROOT / "tools" / "playback-parity-v1" / "playback-source-inventory-report-20260612-100033.txt"

SOURCE_FILES = [
    "server.js",
    "public/app.js",
    "public/player.js",
    "public/details.js",
    "public/sw.js",
    "public/boot.js",
    "routes/dashboard.js",
]

FRONTEND_FUNCTIONS = [
    "attachPlayerSource",
    "openLiveChannel",
    "isMobilePlaybackClient",
    "showVlcPlaybackNotice",
    "streamUrlFor",
    "fetchLocalPlaybackPlan",
    "fetchFtpPlaybackPlan",
    "planNeedsSourceSeek",
    "ftpDirectPlayable",
    "ftpProxySrc",
    "ftpRawSrc",
    "desktopFtpPlaybackSrc",
    "ftpTranscodeSrc",
    "localDirectPlayable",
    "localFileForStreamId",
    "ftpPlaybackSrc",
    "subtitleTextTrackCodecs",
    "subtitleCanRenderAsVtt",
    "ftpSubtitleSrc",
    "resolveFtpPlayUrl",
    "loadFtpTrackOptions",
    "loadFtpDuration",
    "playFtpMedia",
    "playStream",
    "setAudioTrack",
    "selectQuality",
    "loadSubtitles",
]

SERVER_FUNCTIONS = [
    "isMobilePlaybackRequest",
    "remotePlayUrls",
    "isRemoteDirectPlayable",
    "remoteVideoCanCopy",
    "readRemoteUrlParam",
    "findCatalogItemByStreamUrl",
    "getCachedMediaInfo",
    "startMobileHlsSession",
    "waitForPlaylist",
    "cleanupMobileHlsSessions",
    "directStream",
    "remuxStream",
    "transcodeStream",
]

ENTRYPOINT_TOKENS = {
    "movie_card_play": "playFtpMedia(",
    "series_episode_play": "playEpisode(",
    "hero_play_button": "heroPlayBtn",
    "live_card_play": "openLiveChannel(",
    "local_stream_play": "playStream(",
    "detail_modal_play": "playCurrentMovie",
}

DANGER_TOKENS = {
    "ftp_ffmpeg_stream": "app.get('/api/ftp/stream'",
    "mobile_hls_startup": "function startMobileHlsSession(",
    "mobile_hls_routes": "app.get('/api/mobile-hls/",
    "local_transcode": "function transcodeStream(",
    "local_remux": "function remuxStream(",
    "ftp_subtitle_ffmpeg": "app.get('/api/ftp/subtitle/:track.vtt'",
    "remote_probe": "app.get(['/api/ftp/media-info', '/api/ftp/info']",
    "poster_cache_proxy": "app.get('/poster-cache'",
    "live_playlist_proxy": "app.get('/live/:channelId/playlist.m3u8'",
    "live_segment_proxy": "app.get('/live/:channelId/segment'",
}


def read_text(relative_path: str) -> str:
    path = ROOT / relative_path
    return path.read_text(encoding="utf-8") if path.exists() else ""


def present_function(text: str, name: str) -> bool:
    return bool(re.search(rf"(?:async\s+)?function\s+{re.escape(name)}\s*\(", text))


def app_routes(server: str) -> list[str]:
    routes = []
    pattern = re.compile(r"app\.(get|post|delete)\(([^,\n]+)")
    for method, raw_route in pattern.findall(server):
        cleaned = raw_route.strip()
        routes.append(f"{method.upper()} {cleaned}")
    return routes


def endpoint_refs(text: str) -> list[str]:
    refs = sorted(set(re.findall(r"['`](/(?:api|live|stream|subtitles|poster-cache)[^'`?${}]*)", text)))
    return refs


def status(name: str, ok: bool, note: str = "") -> str:
    suffix = f"; {note}" if note else ""
    return f"- {name}: {'present' if ok else 'missing'}{suffix}"


def main() -> int:
    write_report = "--write-report" in sys.argv
    server = read_text("server.js")
    frontend = "\n".join(read_text(path) for path in ["public/app.js", "public/player.js", "public/details.js", "public/sw.js", "public/boot.js"])
    all_js = server + "\n" + frontend

    frontend_function_lines = [status(name, present_function(frontend, name)) for name in FRONTEND_FUNCTIONS]
    server_function_lines = [status(name, present_function(server, name)) for name in SERVER_FUNCTIONS]
    entrypoint_lines = [status(name, token in frontend, token) for name, token in ENTRYPOINT_TOKENS.items()]
    danger_lines = [status(name, token in all_js, token) for name, token in DANGER_TOKENS.items()]
    server_route_lines = [f"- {route}" for route in app_routes(server) if any(key in route for key in ["/api/ftp", "/api/mobile-hls", "/api/play-url", "/stream", "/subtitles", "/live", "/poster-cache"])]
    frontend_endpoint_lines = [f"- {ref}" for ref in endpoint_refs(frontend)]

    missing_core = [
        name for name, ok in [
            ("desktopFtpPlaybackSrc", present_function(frontend, "desktopFtpPlaybackSrc")),
            ("playFtpMedia", present_function(frontend, "playFtpMedia")),
            ("isMobilePlaybackClient", present_function(frontend, "isMobilePlaybackClient")),
            ("startMobileHlsSession", present_function(server, "startMobileHlsSession")),
            ("remotePlayUrls", present_function(server, "remotePlayUrls")),
        ] if not ok
    ]

    ok = not missing_core
    lines = [
        f"Status: {'PASS' if ok else 'FAIL'}",
        "mode: read-only playback source inventory",
        "server_started: no",
        "media_sources_called: no",
        "ffmpeg_started: no",
        "runtime_playback_changed: no",
        "source_files_inspected:",
        *[f"- {path}: {'present' if (ROOT / path).exists() else 'missing'}" for path in SOURCE_FILES],
        "frontend_playback_functions:",
        *frontend_function_lines,
        "server_playback_functions:",
        *server_function_lines,
        "server_playback_routes:",
        *server_route_lines,
        "frontend_player_entrypoints:",
        *entrypoint_lines,
        "frontend_endpoint_references:",
        *frontend_endpoint_lines,
        "desktop_direct_play_path:",
        "- playFtpMedia -> isMobilePlaybackClient false -> desktopFtpPlaybackSrc -> ftpRawSrc for ftp URLs or ftpProxySrc for http(s) URLs.",
        "- Desktop performance notices keep FFmpeg off, keep original quality, and disable extra audio-track transcoding.",
        "mobile_hls_path:",
        "- isMobilePlaybackClient true -> mobile=1 planning flag -> /api/mobile-hls/ftp/index.m3u8 or /api/mobile-hls/local/:id/index.m3u8 when required.",
        "- attachPlayerSource handles hls mode with Hls.js or native m3u8 support.",
        "subtitle_audio_handling:",
        "- Frontend loads FTP track options from /api/ftp/media-info and subtitles from /api/ftp/subtitle/:track.vtt.",
        "- Local playback uses /api/subtitles/:id and /subtitles/:id/embedded/:streamIdx.vtt.",
        "- Desktop direct-play intentionally blocks extra audio tracks because that would require FFmpeg.",
        "danger_zones:",
        *danger_lines,
        "haskell_future_mirror_candidates:",
        "- Shadow-only playback planner decision table for desktop/mobile/live cases.",
        "- Parser-only URL planner for ftpProxySrc, ftpRawSrc, and ftpTranscodeSrc outputs.",
        "- Read-only route mirror for /api/play-url response shape.",
        "- Fixture-only mobile HLS planner mirror; no FFmpeg startup.",
        "- Live TV m3u8 contract mirror; no segment proxy changes.",
        f"missing_core_tokens: {missing_core}",
    ]

    output = "\n".join(lines) + "\n"
    if write_report:
        REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
        REPORT_PATH.write_text(output, encoding="utf-8")
    sys.stdout.write(output)
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())

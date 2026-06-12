#!/usr/bin/env python3
"""Read-only playback migration blocker map.

This report names playback routes and frontend selectors that are too risky to
port before stronger parity exists. It does not start the server, call media
sources, run FFmpeg, or alter playback behavior.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
REPORT_PATH = ROOT / "tools" / "playback-parity-v1" / "playback-blocker-map-20260612-092756.txt"


def read_text(relative_path: str) -> str:
    return (ROOT / relative_path).read_text(encoding="utf-8")


def has(text: str, token: str) -> bool:
    return token in text


def route_present(server: str, route: str) -> bool:
    escaped = re.escape(route)
    return bool(re.search(r"app\.get\([^)]*" + escaped, server))


def status_line(name: str, ok: bool, note: str) -> str:
    return f"- {name}: {'present' if ok else 'missing'}; {note}"


def main() -> int:
    write_report = "--write-report" in sys.argv
    frontend = "\n".join(read_text(path) for path in ["public/app.js", "public/player.js", "public/boot.js"] if (ROOT / path).exists())
    server = read_text("server.js")

    must_preserve = [
        ("desktop direct FTP selector", has(frontend, "function desktopFtpPlaybackSrc(url)"), "desktop chooses raw/proxy original source before any mobile planning"),
        ("desktop keeps FFmpeg off", has(frontend, "Desktop performance mode kept FFmpeg off"), "desktop direct-play must not be auto-transcoded"),
        ("desktop original quality only", has(frontend, "Desktop performance mode streams original quality only"), "desktop should not be downscaled"),
        ("mobile client detector", has(frontend, "function isMobilePlaybackClient()"), "mobile-only planning branch"),
        ("mobile HLS request flag", has(frontend, "if(isMobilePlaybackClient())params.set('mobile','1')"), "mobile HLS only when required"),
        ("server mobile request detector", has(server, "function isMobilePlaybackRequest(req)"), "server separates mobile from desktop"),
        ("mobile HLS profile", has(server, "MOBILE_HLS_PROFILE"), "mobile session identity is profile-scoped"),
        ("FTP proxy route", route_present(server, "/api/ftp/proxy"), "desktop HTTP(S) direct-play/proxy path"),
        ("FTP stream route", route_present(server, "/api/ftp/stream"), "FFmpeg path exists but must not become desktop default"),
        ("mobile HLS FTP route", route_present(server, "/api/mobile-hls/ftp/index.m3u8"), "mobile HLS route exists"),
        ("mobile HLS local route", route_present(server, "/api/mobile-hls/local/:id/index.m3u8"), "mobile local HLS route exists"),
    ]

    dangerous_paths = [
        ("/api/ftp/stream", "FFmpeg remote FTP transcode/remux path; do not make desktop default"),
        ("/api/mobile-hls/ftp/index.m3u8", "mobile-only HLS session startup; do not use for desktop direct-play"),
        ("/api/mobile-hls/local/:id/index.m3u8", "mobile-only local HLS session startup"),
        ("/api/mobile-hls/:scope/:key/:file", "HLS segment serving and session lifecycle"),
        ("/api/ftp/subtitle/:track.vtt", "FFmpeg subtitle extraction path"),
        ("/api/ftp/media-info", "remote probe path; may be slow/failure-prone"),
        ("/api/ftp/duration", "remote duration probe path"),
        ("/live/:channelId/playlist.m3u8", "live TV playlist rewriting, separate from playback migration"),
        ("/live/:channelId/segment", "live TV segment proxying, separate from playback migration"),
    ]

    frontend_references = [
        ("/api/playback/local", has(frontend, "/api/playback/local/"), route_present(server, "/api/playback/local"), "frontend planner reference"),
        ("/api/playback/ftp", has(frontend, "/api/playback/ftp?"), route_present(server, "/api/playback/ftp"), "frontend planner reference"),
        ("/api/playback/movie", has(frontend, "/api/playback/movie/"), route_present(server, "/api/playback/movie"), "frontend planner reference"),
        ("/api/ftp/raw", has(frontend, "/api/ftp/raw?url="), route_present(server, "/api/ftp/raw"), "desktop ftp raw helper reference"),
        ("/api/play-url", has(frontend, "/api/play-url"), route_present(server, "/api/play-url"), "current server play-url route"),
        ("/api/ftp/proxy", has(frontend, "/api/ftp/proxy?url="), route_present(server, "/api/ftp/proxy"), "current server proxy route"),
        ("/api/ftp/stream", has(frontend, "/api/ftp/stream?"), route_present(server, "/api/ftp/stream"), "current server FFmpeg route"),
    ]

    hard_blockers = []
    for route, referenced, present, note in frontend_references:
        if referenced and not present:
            hard_blockers.append(f"{route}: referenced by frontend but no matching server route on this branch ({note})")

    missing_preserve = [name for name, ok, _note in must_preserve if not ok]
    ok = not missing_preserve
    lines = [
        f"Status: {'PASS' if ok else 'FAIL'}",
        "mode: read-only playback migration blocker map",
        "server_started: no",
        "media_sources_called: no",
        "ffmpeg_started: no",
        "production_playback_routes_changed: no",
        "desktop_direct_play_original_ftp: preserve",
        "mobile_hls_only_when_required: preserve",
        "automatic_desktop_transcoding: forbidden",
        "forced_desktop_ffmpeg: forbidden",
        "must_preserve_source_tokens:",
        *[status_line(name, present, note) for name, present, note in must_preserve],
        "frontend_route_reference_map:",
        *[
            f"- {route}: frontend_reference={'yes' if referenced else 'no'} server_route={'yes' if present else 'no'}; {note}"
            for route, referenced, present, note in frontend_references
        ],
        "dangerous_runtime_paths:",
        *[f"- {route}: {note}" for route, note in dangerous_paths],
        "safe_read_only_future_candidates:",
        "- static route inventory against server.js and public/app.js",
        "- fixture-only playback plan snapshots that do not call media sources",
        "- parser-only checks for play-url and ftp proxy URL encoding",
        "- mobile/desktop decision-table tests that do not start FFmpeg",
        "hard_blockers_before_haskell_playback_routes:",
        *([f"- {item}" for item in hard_blockers] if hard_blockers else ["- none"]),
        "next_task:",
        "- Add explicit playback planner parity only after the missing frontend/server route references are reconciled in a non-runtime test fixture.",
    ]

    output = "\n".join(lines) + "\n"
    if write_report:
        REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
        REPORT_PATH.write_text(output, encoding="utf-8")
    sys.stdout.write(output)
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())

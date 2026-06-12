#!/usr/bin/env python3
"""Read-only JS/Haskell route inventory gate.

Compares the JavaScript runtime route surface to local Haskell files and known
topic-branch parity areas. It does not start the Node server and does not alter
runtime routes.
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
REPORT_PATH = ROOT / "tools" / "haskell-migration-status" / "route-inventory-report-20260612-092756.txt"


def read_text(relative_path: str) -> str:
    path = ROOT / relative_path
    return path.read_text(encoding="utf-8") if path.exists() else ""


def git_branch_lines() -> list[str]:
    try:
        result = subprocess.run(
            ["git", "branch", "--all", "--list", "*haskell-*", "*test-haskell-*"],
            cwd=ROOT,
            check=False,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
    except OSError:
        return []
    return [line.strip().lstrip("* ").strip() for line in result.stdout.splitlines() if line.strip()]


def local_haskell_text() -> str:
    chunks = []
    for path in ROOT.rglob("*.hs"):
        if ".git" in path.parts:
            continue
        chunks.append(path.read_text(encoding="utf-8", errors="ignore"))
    return "\n".join(chunks)


def token_present(text: str, token: str) -> bool:
    return bool(token and token in text)


def branch_status(branches: list[str], keyword: str) -> str:
    hits = [branch for branch in branches if keyword and keyword in branch]
    if not hits:
        return "no-topic-branch-seen"
    local_hits = [branch for branch in hits if not branch.startswith("remotes/")]
    remote_hits = [branch for branch in hits if branch.startswith("remotes/")]
    if local_hits and remote_hits:
        return f"topic-branch-seen local={len(local_hits)} remote={len(remote_hits)}"
    if local_hits:
        return f"topic-branch-seen local={len(local_hits)}"
    return f"topic-branch-seen remote={len(remote_hits)}"


def main() -> int:
    write_report = "--write-report" in sys.argv
    server = read_text("server.js")
    frontend = "\n".join(
        read_text(path)
        for path in [
            "public/app.js",
            "public/home.js",
            "public/search.js",
            "public/downloads.js",
            "public/livetv.js",
            "public/details.js",
            "routes/dashboard.js",
        ]
    )
    haskell = local_haskell_text()
    branches = git_branch_lines()

    route_rows = [
        ("home-feed", "/api/home-feed", "app.get('/api/home-feed'", "/api/home-feed", "haskell-home-feed", "completed topic parity; local Haskell absent"),
        ("movies", "/api/movies", "app.get('/api/movies'", "/api/movies", "haskell-movies", "completed topic parity; local Haskell absent"),
        ("series", "/api/series", "app.get('/api/series'", "/api/series", "haskell-series", "completed topic parity; local Haskell absent"),
        ("search", "/api/search", "app.get('/api/search'", "/api/search", "haskell-search", "completed topic parity; local Haskell absent"),
        ("sections", "/api/section/:key", "app.get('/api/section/:key'", "/api/section/", "haskell-sections", "completed topic parity; local Haskell absent"),
        ("sections-alias", "/api/sections", "", "/api/sections", "haskell-sections", "frontend contract uses /api/section/:key; /api/sections is alias-only in migration notes"),
        ("details", "/api/details/:type/:id", "app.get('/api/details/:type/:id'", "/api/details/", "haskell-details", "partial details/TMDB parity"),
        ("title-details", "/api/title-details", "app.get('/api/title-details'", "/api/title-details", "haskell-details", "partial details/TMDB parity"),
        ("live-channels", "/api/channels", "app.get('/api/channels'", "/api/channels", "haskell-livetv", "read-only live TV contract audit only"),
        ("live-playlist", "/live/:channelId/playlist.m3u8", "app.get('/live/:channelId/playlist.m3u8'", "/live/", "haskell-livetv", "runtime proxy, do not port yet"),
        ("live-segment", "/live/:channelId/segment", "app.get('/live/:channelId/segment'", "/live/", "haskell-livetv", "runtime proxy, do not port yet"),
        ("play-url", "/api/play-url", "app.get('/api/play-url'", "/api/play-url", "haskell-playback", "legacy JS play URL route"),
        ("playback-local", "/api/playback/local", "", "/api/playback/local", "haskell-playback", "frontend reference, no JS server route on this branch"),
        ("playback-ftp", "/api/playback/ftp", "", "/api/playback/ftp", "haskell-playback", "frontend reference, no JS server route on this branch"),
        ("playback-movie", "/api/playback/movie", "", "/api/playback/movie", "haskell-playback", "frontend reference, no JS server route on this branch"),
        ("mobile-hls-ftp", "/api/mobile-hls/ftp/index.m3u8", "app.get('/api/mobile-hls/ftp/index.m3u8'", "/api/mobile-hls/ftp", "haskell-playback", "mobile HLS runtime path, audit only"),
        ("mobile-hls-local", "/api/mobile-hls/local/:id/index.m3u8", "app.get('/api/mobile-hls/local/:id/index.m3u8'", "/api/mobile-hls/local", "haskell-playback", "mobile HLS runtime path, audit only"),
        ("ftp-proxy", "/api/ftp/proxy", "app.get('/api/ftp/proxy'", "/api/ftp/proxy", "haskell-playback", "desktop proxy/direct path, audit only"),
        ("ftp-stream", "/api/ftp/stream", "app.get('/api/ftp/stream'", "/api/ftp/stream", "haskell-playback", "FFmpeg path, dangerous"),
        ("ftp-raw", "/api/ftp/raw", "", "/api/ftp/raw", "haskell-playback", "frontend helper reference, no JS server route on this branch"),
        ("downloads", "/api/downloads", "app.get('/api/downloads'", "/api/downloads", "haskell-downloads", "completed topic parity; local Haskell absent"),
        ("download-redirect", "/download/:id", "app.get('/download/:id'", "/download/", "haskell-downloads", "redirect behavior must be preserved"),
        ("poster-cache", "/poster-cache", "app.get('/poster-cache'", "/poster-cache", "haskell-poster", "JS poster cache proxy is source of truth"),
        ("dashboard", "/api/dashboard", "app.use('/api/dashboard'", "/api/dashboard", "haskell-dashboard", "Express router; no Haskell route on this branch"),
    ]

    rows = []
    missing_source_truth = []
    route_gaps = []
    for area, route, server_token, frontend_token, branch_keyword, note in route_rows:
        server_present = token_present(server, server_token) if server_token else False
        frontend_present = token_present(frontend, frontend_token) if frontend_token else False
        haskell_present = token_present(haskell, route)
        topic = branch_status(branches, branch_keyword)
        if server_token and not server_present:
            missing_source_truth.append(route)
        if not haskell_present:
            route_gaps.append(route)
        rows.append(
            f"- {area}: route={route} js_server={'yes' if server_present else 'no'} "
            f"frontend_ref={'yes' if frontend_present else 'no'} local_haskell={'yes' if haskell_present else 'no'} "
            f"topic_status={topic}; {note}"
        )

    local_haskell_files = sorted(
        str(path.relative_to(ROOT))
        for path in ROOT.rglob("*.hs")
        if ".git" not in path.parts
    )
    ok = not missing_source_truth
    lines = [
        f"Status: {'PASS' if ok else 'FAIL'}",
        "mode: read-only JS/Haskell route inventory gate",
        "server_started: no",
        "runtime_routes_changed: no",
        f"local_haskell_file_count: {len(local_haskell_files)}",
        f"local_haskell_files: {local_haskell_files}",
        f"haskell_topic_branches_seen: {len(branches)}",
        "route_inventory:",
        *rows,
        f"missing_js_source_truth_routes: {missing_source_truth}",
        f"local_haskell_route_gaps: {route_gaps}",
        "inventory_notes:",
        "- Current branch has no local Haskell route implementation files; topic branch parity exists for downloads, movies, home-feed, series, search, and sections.",
        "- Details, live TV, and playback remain read-only audit/contract areas on this branch.",
        "- Playback frontend/server route mismatches are documented blockers, not runtime changes.",
    ]

    output = "\n".join(lines) + "\n"
    if write_report:
        REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
        REPORT_PATH.write_text(output, encoding="utf-8")
    sys.stdout.write(output)
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""Read-only Live TV channel contract audit.

This validates the channel fields consumed by the current JavaScript frontend
and server proxy without changing channel URLs or playback behavior.
"""

from __future__ import annotations

import json
import re
import sys
from collections import Counter
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parents[2]
REPORT_PATH = ROOT / "tools" / "livetv-parity-v1" / "live-tv-contract-hardening-report-20260612-092756.txt"
HEX_COLOR = re.compile(r"^#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?$")
EXPECTED_CHANNEL_KEYS = {"id", "name", "category", "color", "textColor", "logo", "url"}

SERVER_TOKENS = {
    "channels_api": "app.get('/api/channels'",
    "playlist_proxy": "app.get('/live/:channelId/playlist.m3u8'",
    "segment_proxy": "app.get('/live/:channelId/segment'",
    "channel_file": "CHANNELS_FILE",
    "playlist_rewriter": "function rewriteM3u8(",
}

FRONTEND_TOKENS = {
    "channel_cards": "function svLiveCardHTML(",
    "category_filter": "filterLiveCat = function(cat)",
    "live_grid": "renderLiveGrid = function()",
    "open_live_channel": "openLiveChannel(channelId, channelName)",
    "playlist_src": "/live/${encodeURIComponent(channelId)}/playlist.m3u8",
    "logo_fallback": "ch.logo",
}


def read_text(relative_path: str) -> str:
    return (ROOT / relative_path).read_text(encoding="utf-8")


def valid_url(value: str) -> bool:
    parsed = urlparse(value)
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


def normalized_name(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip()).casefold()


def main() -> int:
    write_report = "--write-report" in sys.argv
    channels = json.loads(read_text("channels.json"))
    server = read_text("server.js")
    live_frontend = read_text("public/livetv.js")
    app_frontend = read_text("public/app.js")
    frontend = live_frontend + "\n" + app_frontend

    failures: list[str] = []
    warnings: list[str] = []

    if not isinstance(channels, list):
        failures.append("channels.json must be a JSON array")
        channels = []

    ids = [str(ch.get("id", "")).strip() for ch in channels if isinstance(ch, dict)]
    names = [normalized_name(str(ch.get("name", ""))) for ch in channels if isinstance(ch, dict)]
    duplicate_ids = sorted([item for item, count in Counter(ids).items() if item and count > 1])
    duplicate_names = sorted([item for item, count in Counter(names).items() if item and count > 1])
    if duplicate_ids:
        failures.append(f"duplicate channel ids: {duplicate_ids}")
    if duplicate_names:
        failures.append(f"duplicate channel names: {duplicate_names}")

    categories = Counter()
    field_counts = Counter()
    missing_logo = 0
    url_count = 0
    logo_count = 0
    root_relative_logo_count = 0
    remote_logo_count = 0
    m3u8_url_count = 0
    for index, channel in enumerate(channels):
        if not isinstance(channel, dict):
            failures.append(f"channel[{index}] is not an object")
            continue
        unknown_keys = sorted(set(channel.keys()) - EXPECTED_CHANNEL_KEYS)
        if unknown_keys:
            warnings.append(f"channel[{index}] has unknown keys: {unknown_keys}")
        channel_id = str(channel.get("id", "")).strip()
        name = str(channel.get("name", "")).strip()
        category = str(channel.get("category", "")).strip()
        color = str(channel.get("color", "")).strip()
        text_color = str(channel.get("textColor", "")).strip()
        logo = str(channel.get("logo", "")).strip()
        url = str(channel.get("url", "")).strip()
        for field in EXPECTED_CHANNEL_KEYS:
            if str(channel.get(field, "")).strip():
                field_counts[field] += 1

        if not channel_id:
            failures.append(f"channel[{index}] missing id")
        if channel_id != str(channel.get("id", "")):
            failures.append(f"channel[{index}] id has leading/trailing whitespace")
        if not re.match(r"^[A-Za-z0-9_-]+$", channel_id):
            failures.append(f"channel[{index}] id is not route-safe: {channel_id!r}")
        if not name:
            failures.append(f"channel[{index}] missing name")
        if name != str(channel.get("name", "")):
            failures.append(f"{channel_id or index} name has leading/trailing whitespace")
        if not category:
            failures.append(f"channel[{index}] missing category")
        else:
            categories[category] += 1
        if category != str(channel.get("category", "")):
            failures.append(f"{channel_id or index} category has leading/trailing whitespace")
        if not HEX_COLOR.match(color):
            failures.append(f"{channel_id or index} invalid color: {color!r}")
        if not HEX_COLOR.match(text_color):
            failures.append(f"{channel_id or index} invalid textColor: {text_color!r}")
        if not url:
            failures.append(f"{channel_id or index} missing url")
        elif url != str(channel.get("url", "")):
            failures.append(f"{channel_id or index} url has leading/trailing whitespace")
        elif not valid_url(url):
            failures.append(f"{channel_id or index} invalid url: {url!r}")
        else:
            url_count += 1
            if ".m3u8" not in url.lower():
                failures.append(f"{channel_id} url does not include .m3u8")
            else:
                m3u8_url_count += 1
        if logo:
            logo_count += 1
            if not (valid_url(logo) or logo.startswith("/")):
                failures.append(f"{channel_id} logo is not http(s) or root-relative")
            elif valid_url(logo):
                remote_logo_count += 1
            elif logo.startswith("/"):
                root_relative_logo_count += 1
        else:
            missing_logo += 1

    missing_server = [name for name, token in SERVER_TOKENS.items() if token not in server]
    missing_frontend = [name for name, token in FRONTEND_TOKENS.items() if token not in frontend]
    failures.extend(f"missing server token: {name}" for name in missing_server)
    failures.extend(f"missing frontend token: {name}" for name in missing_frontend)

    ok = not failures
    lines = [
        f"Status: {'PASS' if ok else 'FAIL'}",
        "mode: read-only live TV channel contract audit",
        "server_started: no",
        "stream_urls_modified: no",
        f"channel_count: {len(channels)}",
        f"url_count: {url_count}",
        f"m3u8_url_count: {m3u8_url_count}",
        f"logo_count: {logo_count}",
        f"missing_logo_count: {missing_logo}",
        f"remote_logo_count: {remote_logo_count}",
        f"root_relative_logo_count: {root_relative_logo_count}",
        f"category_count: {len(categories)}",
        f"categories: {dict(sorted(categories.items()))}",
        f"field_counts: {dict(sorted(field_counts.items()))}",
        f"duplicate_ids: {duplicate_ids}",
        f"duplicate_names: {duplicate_names}",
        f"failures: {failures}",
        f"warnings: {warnings}",
        "logo_contract: optional; current frontend uses initials when logo is absent",
        "url_contract: required .m3u8 http(s) URL for playable live channels and preserved verbatim",
        "hardening_checks: route-safe unique id, unique normalized name, category presence, color/textColor hex, optional valid logo, required m3u8 URL",
    ]

    output = "\n".join(lines) + "\n"
    if write_report:
        REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
        REPORT_PATH.write_text(output, encoding="utf-8")
    sys.stdout.write(output)
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())

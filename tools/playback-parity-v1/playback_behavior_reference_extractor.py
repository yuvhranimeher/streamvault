#!/usr/bin/env python3
"""Read-only JS playback behavior reference extractor."""

from __future__ import annotations

import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
REPORT_PATH = ROOT / "tools" / "playback-parity-v1" / "playback-behavior-reference-report-20260612-100033.txt"

JS_FILES = [
    "server.js",
    "public/app.js",
    "public/player.js",
    "public/details.js",
    "public/sw.js",
    "public/boot.js",
    "routes/dashboard.js",
]

PATTERNS = {
    "hls": re.compile(r"\bHls\b|hlsInstance|mobile-hls|\.m3u8|mpegurl|hlsSession", re.IGNORECASE),
    "ffmpeg": re.compile(r"\bffmpeg\b|FFmpeg|transcode|remux|spawn\('ffmpeg'", re.IGNORECASE),
    "direct_play": re.compile(r"directPlayable|direct-play|desktopFtpPlaybackSrc|ftpRawSrc|ftpProxySrc|original stream|original quality", re.IGNORECASE),
    "mobile_condition": re.compile(r"isMobilePlaybackClient|isMobilePlaybackRequest|mobilePlayback|mobile=1|params\.set\('mobile'|params\.set\(\"mobile\"", re.IGNORECASE),
}


def read_text(relative_path: str) -> str:
    path = ROOT / relative_path
    return path.read_text(encoding="utf-8") if path.exists() else ""


def function_names(text: str) -> list[str]:
    names = set(re.findall(r"(?:async\s+)?function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(", text))
    names.update(re.findall(r"(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>", text))
    return sorted(names)


def endpoints(text: str) -> list[str]:
    found = set(re.findall(r"['`](/(?:api|live|stream|subtitles|poster-cache|download)[^'`\"${}]*)", text))
    found.update(re.findall(r"app\.(?:get|post|delete)\(([^,\n]+)", text))
    return sorted(item.strip() for item in found)


def matching_lines(relative_path: str, text: str, pattern: re.Pattern[str], limit: int = 80) -> list[str]:
    matches = []
    for lineno, line in enumerate(text.splitlines(), 1):
        if pattern.search(line):
            compact = re.sub(r"\s+", " ", line.strip())
            matches.append(f"{relative_path}:{lineno}: {compact[:220]}")
            if len(matches) >= limit:
                break
    return matches


def relevant_functions(names: list[str]) -> list[str]:
    keywords = re.compile(r"play|stream|hls|ftp|subtitle|audio|quality|track|mobile|direct|proxy|transcode|remux|poster", re.IGNORECASE)
    return [name for name in names if keywords.search(name)]


def main() -> int:
    write_report = "--write-report" in sys.argv
    texts = {path: read_text(path) for path in JS_FILES}
    combined = "\n".join(texts.values())

    function_set = sorted(set().union(*(function_names(text) for text in texts.values())))
    playback_functions = relevant_functions(function_set)
    endpoint_set = endpoints(combined)
    reports = {name: [] for name in PATTERNS}
    for path, text in texts.items():
        if not text:
            continue
        for name, pattern in PATTERNS.items():
            reports[name].extend(matching_lines(path, text, pattern, limit=40))
    for name in reports:
        reports[name] = reports[name][:100]

    required = {
        "playFtpMedia": "playFtpMedia" in playback_functions,
        "desktopFtpPlaybackSrc": "desktopFtpPlaybackSrc" in playback_functions,
        "isMobilePlaybackClient": "isMobilePlaybackClient" in playback_functions,
        "startMobileHlsSession": "startMobileHlsSession" in playback_functions,
        "api_ftp_proxy": any("/api/ftp/proxy" in item for item in endpoint_set),
        "mobile_hls": bool(reports["hls"]),
        "direct_play": bool(reports["direct_play"]),
        "mobile_conditions": bool(reports["mobile_condition"]),
    }
    missing = [name for name, ok in required.items() if not ok]
    ok = not missing

    lines = [
        f"Status: {'PASS' if ok else 'FAIL'}",
        "mode: read-only JS playback behavior reference extractor",
        "server_started: no",
        "media_sources_called: no",
        "runtime_playback_changed: no",
        f"js_file_count: {sum(1 for text in texts.values() if text)}",
        f"detected_function_count: {len(function_set)}",
        f"detected_playback_function_count: {len(playback_functions)}",
        "detected_function_names:",
        *[f"- {name}" for name in playback_functions],
        f"detected_endpoint_count: {len(endpoint_set)}",
        "detected_endpoints:",
        *[f"- {endpoint}" for endpoint in endpoint_set if any(key in endpoint for key in ["/api/ftp", "/api/mobile-hls", "/api/playback", "/api/play-url", "/live", "/stream", "/subtitles", "/poster-cache", "/download"])],
        f"hls_reference_count: {len(reports['hls'])}",
        "detected_hls_references:",
        *[f"- {line}" for line in reports["hls"]],
        f"ffmpeg_reference_count: {len(reports['ffmpeg'])}",
        "detected_ffmpeg_references:",
        *[f"- {line}" for line in reports["ffmpeg"]],
        f"direct_play_reference_count: {len(reports['direct_play'])}",
        "detected_direct_play_references:",
        *[f"- {line}" for line in reports["direct_play"]],
        f"mobile_condition_reference_count: {len(reports['mobile_condition'])}",
        "detected_mobile_conditions:",
        *[f"- {line}" for line in reports["mobile_condition"]],
        f"missing_required_references: {missing}",
    ]

    output = "\n".join(lines) + "\n"
    if write_report:
        REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
        REPORT_PATH.write_text(output, encoding="utf-8")
    sys.stdout.write(output)
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""Read-only home sections safety gate.

Validates the active 44-row homepage section contract in public/home.js without
changing frontend behavior or section data.
"""

from __future__ import annotations

import re
import sys
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
REPORT_PATH = ROOT / "tools" / "sections-parity-v1" / "home-sections-safety-report-20260612-092756.txt"
EXPECTED_ROW_COUNT = 44

REQUIRED_HOME_TOKENS = {
    "active_array": "var SV_PERF_HOME_MAIN = [",
    "row_lookup": "SV_PERF_HOME_BY_ID",
    "ensure_row": "svEnsureHomeRow = function(rowId)",
    "dynamic_row_id": "row.id = rowId",
    "dynamic_track_id": "track.id = meta.trackId",
    "section_dataset": "row.dataset.sectionKey = meta.sectionKey",
    "section_fetch": "/api/section/${encodeURIComponent(meta.sectionKey)}",
    "open_section": "openHomeSection = function(rowId)",
}

REQUIRED_SERVER_TOKENS = {
    "section_route": "app.get('/api/section/:key'",
    "home_feed_route": "app.get('/api/home-feed'",
}


def read_text(relative_path: str) -> str:
    return (ROOT / relative_path).read_text(encoding="utf-8")


def ascii_text(value: str) -> str:
    return value.encode("unicode_escape").decode("ascii")


def extract_active_rows(home_js: str) -> list[dict[str, str]]:
    match = re.search(r"var\s+SV_PERF_HOME_MAIN\s*=\s*\[(.*?)\]\s*;", home_js, re.S)
    if not match:
        return []
    body = match.group(1)
    rows = []
    row_re = re.compile(
        r"\{\s*rowId:'([^']+)'\s*,\s*trackId:'([^']+)'\s*,\s*sectionKey:'([^']+)'\s*,\s*title:'([^']*)'\s*\}",
        re.S,
    )
    for row_id, track_id, section_key, title in row_re.findall(body):
        rows.append({
            "rowId": row_id,
            "trackId": track_id,
            "sectionKey": section_key,
            "title": title,
        })
    return rows


def duplicates(values: list[str]) -> list[str]:
    counts = Counter(values)
    return sorted(value for value, count in counts.items() if count > 1)


def main() -> int:
    write_report = "--write-report" in sys.argv
    home_js = read_text("public/home.js")
    server_js = read_text("server.js")
    index_html = read_text("public/index.html")
    rows = extract_active_rows(home_js)

    failures: list[str] = []
    warnings: list[str] = []
    if len(rows) != EXPECTED_ROW_COUNT:
        failures.append(f"expected {EXPECTED_ROW_COUNT} active rows, found {len(rows)}")

    duplicate_row_ids = duplicates([row["rowId"] for row in rows])
    duplicate_track_ids = duplicates([row["trackId"] for row in rows])
    duplicate_section_keys = duplicates([row["sectionKey"] for row in rows])
    if duplicate_row_ids:
        failures.append(f"duplicate rowId values: {duplicate_row_ids}")
    if duplicate_track_ids:
        failures.append(f"duplicate trackId values: {duplicate_track_ids}")
    if duplicate_section_keys:
        failures.append(f"duplicate sectionKey values: {duplicate_section_keys}")

    for index, row in enumerate(rows):
        row_id = row["rowId"]
        track_id = row["trackId"]
        section_key = row["sectionKey"]
        title = row["title"]
        if not re.fullmatch(r"[A-Za-z][A-Za-z0-9]*Row", row_id):
            failures.append(f"row[{index}] invalid rowId: {row_id!r}")
        if not re.fullmatch(r"[A-Za-z][A-Za-z0-9]*Track", track_id):
            failures.append(f"row[{index}] invalid trackId: {track_id!r}")
        if not re.fullmatch(r"[A-Za-z][A-Za-z0-9]*", section_key):
            failures.append(f"row[{index}] invalid sectionKey: {section_key!r}")
        if not title.strip():
            failures.append(f"row[{index}] missing title")
        if row_id.replace("Row", "") and track_id.replace("Track", "") and row_id.replace("Row", "") != track_id.replace("Track", ""):
            warnings.append(f"{row_id} track prefix differs from row prefix: {track_id}")

    missing_home_tokens = [name for name, token in REQUIRED_HOME_TOKENS.items() if token not in home_js]
    missing_server_tokens = [name for name, token in REQUIRED_SERVER_TOKENS.items() if token not in server_js]
    failures.extend(f"missing public/home.js token: {name}" for name in missing_home_tokens)
    failures.extend(f"missing server.js token: {name}" for name in missing_server_tokens)

    html_row_refs = [row["rowId"] for row in rows if f'id="{row["rowId"]}"' in index_html]
    html_track_refs = [row["trackId"] for row in rows if f'id="{row["trackId"]}"' in index_html]

    row_lines = [
        f"- {index + 1:02d}: rowId={row['rowId']} trackId={row['trackId']} sectionKey={row['sectionKey']} title={ascii_text(row['title'])}"
        for index, row in enumerate(rows)
    ]

    ok = not failures
    lines = [
        f"Status: {'PASS' if ok else 'FAIL'}",
        "mode: read-only home sections safety gate",
        "frontend_runtime_changed: no",
        "section_data_changed: no",
        f"expected_active_row_count: {EXPECTED_ROW_COUNT}",
        f"actual_active_row_count: {len(rows)}",
        f"html_predeclared_row_count: {len(html_row_refs)}",
        f"html_predeclared_track_count: {len(html_track_refs)}",
        f"duplicate_row_ids: {duplicate_row_ids}",
        f"duplicate_track_ids: {duplicate_track_ids}",
        f"duplicate_section_keys: {duplicate_section_keys}",
        f"missing_home_tokens: {missing_home_tokens}",
        f"missing_server_tokens: {missing_server_tokens}",
        f"warnings: {warnings}",
        f"failures: {failures}",
        "active_rows:",
        *row_lines,
        "safety_notes:",
        "- public/home.js dynamically creates rows/tracks through svEnsureHomeRow, so HTML does not need to predeclare every active row.",
        "- Section expansion uses /api/section/:key and home loading uses /api/home-feed; both remain JavaScript source of truth.",
    ]

    output = "\n".join(lines) + "\n"
    if write_report:
        REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
        REPORT_PATH.write_text(output, encoding="utf-8")
    sys.stdout.write(output)
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())

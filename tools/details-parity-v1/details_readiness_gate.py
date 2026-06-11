#!/usr/bin/env python3
"""Read-only details/TMDB parity readiness gate.

This gate intentionally avoids starting the Node server or calling TMDB. It
checks that the current JavaScript details contract is discoverable on master
and records the smallest safe migration gap: details parity tooling is
referenced by package.json but not present on master.
"""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
REPORT_PATH = ROOT / "tools" / "details-parity-v1" / "details-readiness-report-20260612-001656.txt"

REQUIRED_SERVER_TOKENS = {
    "details_route": "app.get('/api/details/:type/:id'",
    "title_details_route": "app.get('/api/title-details'",
    "local_details_object": "function localDetailsObject(",
    "tmdb_extended_builder": "async function buildTmdbExtendedDetails(",
    "title_details_builder": "async function buildTitleDetails(",
    "detail_cache_file": "DETAIL_CACHE_FILE",
    "tmdb_get": "function tmdbGet(",
    "tmdb_id_parser": "function tmdbIdFromRequest(",
}

REQUIRED_RESPONSE_FIELDS = [
    "ok",
    "localOnly",
    "type",
    "id",
    "tmdbId",
    "imdbId",
    "title",
    "overview",
    "poster",
    "backdrop",
    "year",
    "rating",
    "runtime",
    "genres",
    "language",
    "ratings",
    "trailers",
    "cast",
    "crew",
    "productionCompanies",
    "similar",
    "moreByDirector",
    "director",
    "episodes",
    "about",
    "playbackInfo",
]

REQUIRED_FRONTEND_TOKENS = {
    "details_fetch": "/api/details/${routeType}/${routeId}",
    "merge_details": "function mergeTitleDetails(",
    "render_online_sections": "function renderOnlineSections(",
    "movie_details_loader": "async function loadMovieOnlineDetails(",
    "series_details_loader": "async function loadSeriesOnlineDetails(",
    "local_fallback": "function localTitleDetails(",
}


def read_text(relative_path: str) -> str:
    return (ROOT / relative_path).read_text(encoding="utf-8")


def git_branch_lines() -> list[str]:
    try:
        result = subprocess.run(
            ["git", "branch", "--all", "--list", "*haskell-details*", "*test-haskell-details*"],
            cwd=ROOT,
            check=False,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        return [line.strip() for line in result.stdout.splitlines() if line.strip()]
    except OSError:
        return []


def package_detail_scripts() -> dict[str, str]:
    package = json.loads(read_text("package.json"))
    scripts = package.get("scripts", {})
    return {name: value for name, value in scripts.items() if name.startswith("details:")}


def script_target(command: str) -> str:
    parts = command.split()
    for part in parts:
        if part.startswith("tools/details-parity-v1/"):
            return part
    return ""


def main() -> int:
    write_report = "--write-report" in sys.argv
    server = read_text("server.js")
    app = read_text("public/app.js")

    missing_server = [name for name, token in REQUIRED_SERVER_TOKENS.items() if token not in server]
    missing_fields = [
        field for field in REQUIRED_RESPONSE_FIELDS
        if f"{field}:" not in server and f"{field}: " not in server
    ]
    missing_frontend = [name for name, token in REQUIRED_FRONTEND_TOKENS.items() if token not in app]

    detail_scripts = package_detail_scripts()
    missing_script_targets = []
    for name, command in detail_scripts.items():
        target = script_target(command)
        if target and not (ROOT / target).exists():
            missing_script_targets.append(f"{name} -> {target}")

    detail_branches = git_branch_lines()
    node_available = shutil.which("node") is not None
    ghc_available = shutil.which("ghc") is not None
    cabal_available = shutil.which("cabal") is not None

    ok = not missing_server and not missing_fields and not missing_frontend
    lines = [
        f"Status: {'PASS' if ok else 'FAIL'}",
        "mode: read-only details/TMDB readiness gate",
        "server_started: no",
        "tmdb_network_calls: no",
        f"node_available: {str(node_available).lower()}",
        f"ghc_available: {str(ghc_available).lower()}",
        f"cabal_available: {str(cabal_available).lower()}",
        f"details_package_scripts: {len(detail_scripts)}",
        f"missing_package_script_targets: {len(missing_script_targets)}",
        f"details_topic_branches_seen: {len(detail_branches)}",
        f"missing_server_tokens: {missing_server}",
        f"missing_response_fields: {missing_fields}",
        f"missing_frontend_tokens: {missing_frontend}",
        "next_safe_gap: package.json references details parity gates, but master does not carry those tools; keep adding read-only contract gates before route changes.",
    ]
    if missing_script_targets:
        lines.append("missing_package_script_target_list:")
        lines.extend(f"- {item}" for item in missing_script_targets)
    if detail_branches:
        lines.append("details_topic_branch_list:")
        lines.extend(f"- {line}" for line in detail_branches[:24])

    output = "\n".join(lines) + "\n"
    if write_report:
        REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
        REPORT_PATH.write_text(output, encoding="utf-8")
    sys.stdout.write(output)
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())

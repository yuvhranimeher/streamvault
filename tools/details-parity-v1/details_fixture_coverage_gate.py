#!/usr/bin/env python3
"""Read-only details fixture coverage gate.

This gate checks that catalog data still contains the representative fixture
shapes needed before a Haskell details/TMDB route can be compared safely.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any, Callable


ROOT = Path(__file__).resolve().parents[2]
REPORT_PATH = ROOT / "tools" / "details-parity-v1" / "details-fixture-coverage-report-20260612-092756.txt"


def load_catalog() -> dict[str, Any]:
    return json.loads((ROOT / "catalog.json").read_text(encoding="utf-8"))


def seasons_for(item: dict[str, Any]) -> list[dict[str, Any]]:
    seasons = item.get("seasons")
    if isinstance(seasons, list):
        return [season for season in seasons if isinstance(season, dict)]
    if isinstance(seasons, dict):
        return [{"season": str(key), "episodes": value} for key, value in seasons.items()]
    return []


def episodes_for(item: dict[str, Any]) -> list[dict[str, Any]]:
    episodes: list[dict[str, Any]] = []
    for season in seasons_for(item):
        season_episodes = season.get("episodes")
        if isinstance(season_episodes, list):
            episodes.extend(ep for ep in season_episodes if isinstance(ep, dict))
    return episodes


def first_text(*values: Any) -> str:
    for value in values:
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


def count_matches(items: list[dict[str, Any]], predicate: Callable[[dict[str, Any]], bool]) -> int:
    return sum(1 for item in items if predicate(item))


def first_match(items: list[dict[str, Any]], predicate: Callable[[dict[str, Any]], bool]) -> tuple[int, dict[str, Any]] | None:
    for index, item in enumerate(items):
        if predicate(item):
            return index, item
    return None


def sample_title(item: dict[str, Any]) -> str:
    return first_text(item.get("name"), item.get("title"), item.get("filename"), item.get("file")) or "UNTITLED"


def sample_line(name: str, count: int, sample: tuple[int, dict[str, Any]] | None, extra: str = "") -> str:
    if not sample:
        return f"- {name}: count={count} sample=MISSING"
    index, item = sample
    suffix = f" {extra}" if extra else ""
    return f"- {name}: count={count} sample_index={index} sample_title={sample_title(item)!r}{suffix}"


def main() -> int:
    write_report = "--write-report" in sys.argv
    catalog = load_catalog()
    movies = [item for item in catalog.get("movies", []) if isinstance(item, dict)]
    series = [item for item in catalog.get("series", []) if isinstance(item, dict)]

    checks: list[tuple[str, list[dict[str, Any]], Callable[[dict[str, Any]], bool], str]] = [
        ("movie_poster_and_backdrop", movies, lambda item: bool(item.get("poster") and item.get("backdrop")), "movie full art"),
        ("movie_poster_fallback", movies, lambda item: bool(item.get("poster") and not item.get("backdrop")), "movie poster fallback"),
        ("movie_rating", movies, lambda item: item.get("rating") not in (None, ""), "movie rating shape"),
        ("movie_overview", movies, lambda item: bool(item.get("overview")), "movie overview"),
        ("movie_stream_filename", movies, lambda item: bool(item.get("streamUrl") and item.get("filename")), "movie streamUrl + filename"),
        ("series_poster_and_backdrop", series, lambda item: bool(item.get("poster") and item.get("backdrop")), "series full art"),
        ("series_poster_fallback", series, lambda item: bool(item.get("poster") and not item.get("backdrop")), "series poster fallback"),
        ("series_episode_stream", series, lambda item: any(ep.get("streamUrl") for ep in episodes_for(item)), "episode streamUrl"),
        ("series_multi_season", series, lambda item: len(seasons_for(item)) >= 2, "multi-season series"),
        ("series_episode_filename_fallback", series, lambda item: any(ep.get("filename") and not first_text(ep.get("title"), ep.get("name")) for ep in episodes_for(item)), "episode display title fallback"),
    ]

    missing: list[str] = []
    lines: list[str] = []
    for name, items, predicate, note in checks:
        count = count_matches(items, predicate)
        sample = first_match(items, predicate)
        if count <= 0:
            missing.append(name)
        lines.append(sample_line(name, count, sample, f"note={note!r}"))

    total_episode_count = sum(len(episodes_for(item)) for item in series)
    series_with_episodes = count_matches(series, lambda item: bool(episodes_for(item)))
    ok = not missing
    report = [
        f"Status: {'PASS' if ok else 'FAIL'}",
        "mode: read-only details fixture coverage gate",
        "server_started: no",
        "tmdb_network_calls: no",
        f"catalog_movies: {len(movies)}",
        f"catalog_series: {len(series)}",
        f"catalog_series_with_episodes: {series_with_episodes}",
        f"catalog_episode_count: {total_episode_count}",
        "required_fixture_shapes:",
        *lines,
        f"missing_fixture_shapes: {missing}",
        "coverage_notes:",
        "- These are catalog fixture shapes only; they do not change JS routes, frontend details rendering, or playback behavior.",
        "- Haskell details parity should keep using this coverage before comparing route output for movies, series, art fallback, ratings, and episode streams.",
    ]

    output = "\n".join(report) + "\n"
    if write_report:
        REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
        REPORT_PATH.write_text(output, encoding="utf-8")
    sys.stdout.write(output)
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())

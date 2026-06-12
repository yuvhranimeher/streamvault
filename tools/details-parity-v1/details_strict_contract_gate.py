#!/usr/bin/env python3
"""Read-only details/TMDB strict contract gate.

This gate does not start the Node server and does not call TMDB. It validates
the local JavaScript details contract against representative catalog fixtures,
then reports global data-quality buckets that should block unsafe Haskell route
work until they are intentionally handled.
"""

from __future__ import annotations

import json
import re
import sys
from collections import Counter
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
CATALOG_PATH = ROOT / "catalog.json"
REPORT_PATH = ROOT / "tools" / "details-parity-v1" / "details-strict-contract-report-20260612-092756.txt"

BUCKETS = [
    "missing_title",
    "missing_stream",
    "missing_poster_art",
    "invalid_year",
    "invalid_rating",
    "raw_filename_title",
    "malformed_series",
    "malformed_episode",
    "unsafe_null_field",
]

NOISE_RE = re.compile(
    r"\b("
    r"480p|576p|720p|1080p|1440p|2160p|4k|uhd|hdr|web[- ]?dl|webrip|bluray|brrip|"
    r"dvdrip|hdrip|hdtv|x264|x265|h264|h265|hevc|aac|ac3|eac3|ddp|dts|nf|amzn|"
    r"dual audio|multi audio|msubs|esub"
    r")\b|\.(mkv|mp4|avi|mov)$",
    re.IGNORECASE,
)

ALLOWED_NULL_FIELDS = {
    "poster",
    "backdrop",
    "rating",
    "tmdbId",
    "imdbId",
    "runtime",
    "director",
    "language",
    "productionCompanies",
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


def is_text(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())


def first_text(*values: Any) -> str:
    for value in values:
        if is_text(value):
            return str(value).strip()
    return ""


def valid_year(value: Any) -> bool:
    text = str(value or "").strip()
    return not text or bool(re.fullmatch(r"(19|20)\d{2}", text[:4]))


def valid_rating(value: Any) -> bool:
    if value in (None, ""):
        return True
    try:
        rating = float(value)
    except (TypeError, ValueError):
        return False
    return 0 <= rating <= 10


def raw_filename_title(value: Any) -> bool:
    return bool(is_text(value) and NOISE_RE.search(str(value)))


def list_seasons(seasons: Any) -> list[dict[str, Any]]:
    if isinstance(seasons, list):
        return [season for season in seasons if isinstance(season, dict)]
    if isinstance(seasons, dict):
        normalized = []
        for key, episodes in seasons.items():
            normalized.append({"season": str(key), "episodes": episodes})
        return normalized
    return []


def season_episode_pairs(seasons: Any) -> list[tuple[str, list[Any]]]:
    pairs = []
    for season in list_seasons(seasons):
        label = first_text(season.get("season"), season.get("name"), season.get("title"))
        episodes = season.get("episodes")
        pairs.append((label, episodes if isinstance(episodes, list) else []))
    return pairs


def flatten_episodes(seasons: Any) -> list[dict[str, Any]]:
    episodes = []
    for _, season_episodes in season_episode_pairs(seasons):
        episodes.extend(ep for ep in season_episodes if isinstance(ep, dict))
    return episodes


def movie_response(raw: dict[str, Any], index: int) -> dict[str, Any]:
    name = first_text(raw.get("name"), raw.get("title"))
    poster = raw.get("poster")
    backdrop = raw.get("backdrop") or poster
    rating = raw.get("rating")
    return {
        "ok": True,
        "localOnly": True,
        "type": "movie",
        "id": raw.get("id") or f"ftp_{index}",
        "tmdbId": raw.get("tmdbId") or None,
        "imdbId": raw.get("imdbId") or "",
        "title": name,
        "overview": raw.get("overview") or "",
        "poster": poster or None,
        "backdrop": backdrop or None,
        "year": raw.get("year") or "",
        "rating": rating or None,
        "runtime": raw.get("runtime") or "",
        "genres": raw.get("genre") or "",
        "genre": raw.get("genre") or "",
        "language": raw.get("language") or "",
        "ratings": [{"source": "Catalog", "value": f"{rating}/10", "subvalue": "Local cache", "available": True}] if rating else [],
        "trailers": raw.get("trailers") if isinstance(raw.get("trailers"), list) else [],
        "cast": raw.get("cast") if isinstance(raw.get("cast"), list) else [],
        "crew": raw.get("crew") if isinstance(raw.get("crew"), list) else [],
        "productionCompanies": raw.get("productionCompanies") if isinstance(raw.get("productionCompanies"), list) else [],
        "similar": raw.get("similar") if isinstance(raw.get("similar"), list) else [],
        "moreByDirector": raw.get("moreByDirector") if isinstance(raw.get("moreByDirector"), list) else [],
        "director": raw.get("director") or None,
        "episodes": [],
        "about": [],
        "playbackInfo": [],
        "streamUrl": raw.get("streamUrl") or "",
        "file": raw.get("filename") or raw.get("file") or "",
        "category": raw.get("category") or "",
        "server": raw.get("server") or "",
        "isFtp": True,
    }


def series_response(raw: dict[str, Any], index: int) -> dict[str, Any]:
    name = first_text(raw.get("name"), raw.get("title"))
    poster = raw.get("poster")
    backdrop = raw.get("backdrop") or poster
    rating = raw.get("rating")
    return {
        "ok": True,
        "localOnly": True,
        "type": "tv",
        "id": raw.get("id") or name or f"series_{index}",
        "tmdbId": raw.get("tmdbId") or None,
        "imdbId": raw.get("imdbId") or "",
        "title": name,
        "name": name,
        "overview": raw.get("overview") or "",
        "poster": poster or None,
        "backdrop": backdrop or None,
        "year": raw.get("year") or "",
        "rating": rating or None,
        "runtime": raw.get("runtime") or "",
        "genres": raw.get("genre") or "",
        "genre": raw.get("genre") or "",
        "language": raw.get("language") or "",
        "ratings": [{"source": "Catalog", "value": f"{rating}/10", "subvalue": "Local cache", "available": True}] if rating else [],
        "trailers": raw.get("trailers") if isinstance(raw.get("trailers"), list) else [],
        "cast": raw.get("cast") if isinstance(raw.get("cast"), list) else [],
        "crew": raw.get("crew") if isinstance(raw.get("crew"), list) else [],
        "productionCompanies": raw.get("productionCompanies") if isinstance(raw.get("productionCompanies"), list) else [],
        "similar": raw.get("similar") if isinstance(raw.get("similar"), list) else [],
        "moreByDirector": raw.get("moreByDirector") if isinstance(raw.get("moreByDirector"), list) else [],
        "director": raw.get("director") or None,
        "episodes": raw.get("seasons") or {},
        "seasons": raw.get("seasons") or {},
        "about": [],
        "playbackInfo": [],
        "category": raw.get("category") or "",
        "server": raw.get("server") or "",
        "isFtp": True,
    }


def record_buckets(item: dict[str, Any], kind: str) -> Counter[str]:
    buckets: Counter[str] = Counter()
    title = first_text(item.get("name"), item.get("title"))
    if not title:
        buckets["missing_title"] += 1
    if raw_filename_title(title):
        buckets["raw_filename_title"] += 1
    if not (item.get("poster") or item.get("backdrop")):
        buckets["missing_poster_art"] += 1
    if not valid_year(item.get("year")):
        buckets["invalid_year"] += 1
    if not valid_rating(item.get("rating")):
        buckets["invalid_rating"] += 1
    for key, value in item.items():
        if value is None and key not in ALLOWED_NULL_FIELDS:
            buckets["unsafe_null_field"] += 1
            break

    if kind == "movie":
        if not first_text(item.get("streamUrl"), item.get("url"), item.get("file"), item.get("filename")):
            buckets["missing_stream"] += 1
    else:
        seasons = item.get("seasons")
        pairs = season_episode_pairs(seasons)
        if not pairs or any(not label or not episodes for label, episodes in pairs):
            buckets["malformed_series"] += 1
        episodes = flatten_episodes(seasons)
        if not episodes:
            buckets["malformed_episode"] += 1
            buckets["missing_stream"] += 1
        elif not any(first_text(ep.get("streamUrl"), ep.get("url"), ep.get("file"), ep.get("filename")) for ep in episodes):
            buckets["missing_stream"] += 1
        for episode in episodes[:100]:
            if not first_text(episode.get("title"), episode.get("name"), episode.get("filename")):
                buckets["malformed_episode"] += 1
                break
            if not first_text(episode.get("streamUrl"), episode.get("url"), episode.get("file"), episode.get("filename")):
                buckets["malformed_episode"] += 1
                break
    return buckets


def validate_response(response: dict[str, Any], kind: str) -> Counter[str]:
    failures: Counter[str] = Counter()
    for field in REQUIRED_RESPONSE_FIELDS:
        if field not in response:
            failures["unsafe_null_field"] += 1
            break
    if not is_text(response.get("title")):
        failures["missing_title"] += 1
    if not (response.get("poster") or response.get("backdrop")):
        failures["missing_poster_art"] += 1
    if not valid_year(response.get("year")):
        failures["invalid_year"] += 1
    if not valid_rating(response.get("rating")):
        failures["invalid_rating"] += 1
    if raw_filename_title(response.get("title")):
        failures["raw_filename_title"] += 1
    if kind == "movie" and not first_text(response.get("streamUrl"), response.get("file")):
        failures["missing_stream"] += 1
    if kind == "series":
        seasons = response.get("seasons") or response.get("episodes")
        pairs = season_episode_pairs(seasons)
        if not pairs or any(not label or not episodes for label, episodes in pairs):
            failures["malformed_series"] += 1
        episodes = flatten_episodes(seasons)
        if not episodes:
            failures["malformed_episode"] += 1
            failures["missing_stream"] += 1
        for episode in episodes[:100]:
            if not first_text(episode.get("title"), episode.get("name"), episode.get("filename")):
                failures["malformed_episode"] += 1
                break
            if not first_text(episode.get("streamUrl"), episode.get("url"), episode.get("file"), episode.get("filename")):
                failures["malformed_episode"] += 1
                break
    return failures


def fixture_ok(item: dict[str, Any], kind: str, *, needs_backdrop: bool = False, needs_fallback: bool = False) -> bool:
    title = first_text(item.get("name"), item.get("title"))
    if not title or raw_filename_title(title):
        return False
    if not valid_year(item.get("year")) or not valid_rating(item.get("rating")):
        return False
    if needs_backdrop and not (item.get("poster") and item.get("backdrop")):
        return False
    if needs_fallback and not (item.get("poster") and not item.get("backdrop")):
        return False
    if not (item.get("poster") or item.get("backdrop")):
        return False
    if kind == "movie":
        return bool(first_text(item.get("streamUrl"), item.get("filename"), item.get("file")))
    episodes = flatten_episodes(item.get("seasons"))
    return bool(episodes and any(first_text(ep.get("streamUrl"), ep.get("url"), ep.get("file"), ep.get("filename")) for ep in episodes))


def choose_fixture(items: list[dict[str, Any]], kind: str, *, needs_backdrop: bool = False, needs_fallback: bool = False) -> tuple[int, dict[str, Any]] | None:
    for index, item in enumerate(items):
        if fixture_ok(item, kind, needs_backdrop=needs_backdrop, needs_fallback=needs_fallback):
            return index, item
    return None


def format_counter(counter: Counter[str]) -> str:
    return ", ".join(f"{bucket}={counter.get(bucket, 0)}" for bucket in BUCKETS)


def main() -> int:
    write_report = "--write-report" in sys.argv
    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    movies = [item for item in catalog.get("movies", []) if isinstance(item, dict)]
    series = [item for item in catalog.get("series", []) if isinstance(item, dict)]

    global_movie_buckets: Counter[str] = Counter()
    global_series_buckets: Counter[str] = Counter()
    for item in movies:
        global_movie_buckets.update(record_buckets(item, "movie"))
    for item in series:
        global_series_buckets.update(record_buckets(item, "series"))

    fixture_specs = [
        ("movie_complete_art", "movie", choose_fixture(movies, "movie", needs_backdrop=True)),
        ("movie_poster_backdrop_fallback", "movie", choose_fixture(movies, "movie", needs_fallback=True)),
        ("series_episode_contract", "series", choose_fixture(series, "series", needs_backdrop=True)),
        ("series_poster_backdrop_fallback", "series", choose_fixture(series, "series", needs_fallback=True)),
    ]

    fixture_failures: Counter[str] = Counter()
    fixture_lines: list[str] = []
    for fixture_name, kind, selected in fixture_specs:
        if not selected:
            if kind == "movie":
                fixture_failures["missing_stream"] += 1
            else:
                fixture_failures["malformed_series"] += 1
            fixture_lines.append(f"- {fixture_name}: MISSING")
            continue
        index, item = selected
        response = movie_response(item, index) if kind == "movie" else series_response(item, index)
        failures = validate_response(response, kind)
        fixture_failures.update(failures)
        episode_count = len(flatten_episodes(response.get("seasons") or response.get("episodes"))) if kind == "series" else 0
        art_mode = "poster+backdrop" if response.get("poster") and response.get("backdrop") and response.get("poster") != response.get("backdrop") else "poster-fallback" if response.get("poster") and response.get("backdrop") else "missing-art"
        stream_field = "streamUrl" if response.get("streamUrl") else "episode-streamUrl" if kind == "series" else "file"
        fixture_lines.append(
            f"- {fixture_name}: {'PASS' if not failures else 'FAIL'} "
            f"kind={kind} index={index} title={response.get('title')!r} "
            f"year={response.get('year')!r} rating={response.get('rating')!r} "
            f"art={art_mode} stream_field={stream_field} episodes={episode_count} "
            f"failures={format_counter(failures)}"
        )

    ok = not fixture_failures
    lines = [
        f"Status: {'PASS' if ok else 'FAIL'}",
        "mode: read-only details/TMDB strict contract gate",
        "server_started: no",
        "tmdb_network_calls: no",
        f"catalog_movies: {len(movies)}",
        f"catalog_series: {len(series)}",
        "js_response_contract_fields:",
        "- " + ", ".join(REQUIRED_RESPONSE_FIELDS),
        "failure_buckets:",
        "- " + ", ".join(BUCKETS),
        "strict_fixture_results:",
        *fixture_lines,
        "strict_fixture_failure_counts:",
        "- " + format_counter(fixture_failures),
        "global_movie_bucket_counts:",
        "- " + format_counter(global_movie_buckets),
        "global_series_bucket_counts:",
        "- " + format_counter(global_series_buckets),
        "contract_notes:",
        "- Movie fixtures validate title/name mapping, filename/file fallback, streamUrl presence, year/rating shape, poster/backdrop fallback, and nullable metadata arrays.",
        "- Series fixtures validate title/name mapping, seasons/episodes shape, season keys, episode display title fallback through filename, episode streamUrl/file fallback, and poster/backdrop fallback.",
        "- Global bucket counts are blockers for future Haskell route parity decisions, but this phase fails only when the representative strict fixtures violate the current JS contract.",
    ]

    output = "\n".join(lines) + "\n"
    if write_report:
        REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
        REPORT_PATH.write_text(output, encoding="utf-8")
    sys.stdout.write(output)
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())

# StreamVault Search Migration Notes

Generated during the `haskell-native-search-and-metadata` pass.

## Node `/api/search` Contract

- Route: `GET /api/search`.
- Query params:
  - `q`: trimmed search text. Fewer than 2 characters returns an empty instant response.
  - `page`: one-based, default `1`.
  - `limit`: default `72`, clamped to `1..120`.
  - `kind` or `type`: `movie`, `series`, or `mixed`; default `mixed`.
  - Frontend sends `massive=1`, but the dedicated search route always uses the fast search index.
- Response for successful indexed searches:
  - `{ items, total, page, pages, instant: true, indexed: true }`.
- Response for short queries:
  - `{ items: [], total: 0, page, pages: 0, instant: true }`.
- Error fallback:
  - `{ items: [], total: 0, page: 1, pages: 0, instant: false, error }`.

## Node Data Sources

- `movies/` and `series/` local files via `buildMovieListSync()` and `buildSeriesListSync()`.
- `poster-cache.json` for local poster/TMDB metadata hydration.
- `catalog.json` for FTP movies and series.
- `scan-output/clean-catalog.json` for massive search-only remote media.
- `detail-cache.json` is not used by `/api/search`.
- `episode-title-cache.json` is not used by `/api/search`.
- `data/catalogs/approved-clean-catalog.json` exists, but current Node search does not reference it.

## Node Ranking And Filtering

- Search index is built lazily and cached in memory.
- Entry order before scoring is local movies, FTP movies, massive movies, local series, FTP series, massive series.
- Normalization lowercases, strips punctuation, maps `&` to words, drops common stopwords, and tokenizes.
- Matching requires every query token to match through exact token, prefix, substring, or capped edit distance.
- Fuzzy tolerance:
  - token length `5..7`: edit distance `1`.
  - token length `>=8`: edit distance `2`.
- Scoring boosts exact title, title prefix, phrase-in-title, phrase-in-file, all-name-token hits, exact-token hits, poster/backdrop presence, non-massive source, rating, and year.
- Massive catalog entries without poster/backdrop are penalized.
- If poster-rich results exist, no-poster massive variants are hidden. Otherwise only a small no-poster massive fallback is allowed.
- Final result cap is `120`.

## Haskell Migration Status

- Default `/api/search` remains proxied to Node.
- Guarded rollout flag: `STREAMVAULT_HASKELL_SEARCH_NATIVE=1` lets the Haskell shadow process attempt native `/api/search` with a 1500 ms timeout and fallback to Node.
- Diagnostic route: `GET /__haskell-search-debug?q=...`.
- Haskell search lazily builds and caches an in-memory index after the first native/debug search request.
- Haskell includes local movies, local series, `catalog.json`, and `scan-output/clean-catalog.json` when present.
- Haskell hydrates massive entries from poster-bearing local/FTP items using normalized title/year keys.
- Haskell applies Node-like token matching, typo tolerance, scoring, dedupe, and result caps.

## Known Differences And Gates

- Massive catalog IDs are deterministic Haskell IDs, not Node MD5 IDs.
- Haskell massive parsing is intentionally conservative; exact massive-series grouping may differ from Node.
- First diagnostic search may take roughly a minute on this dataset while the 200MB clean catalog index is built; warmed diagnostic searches are fast.
- Expanded parity found strong top-result overlap for several queries but serious count/poster-presence drift for others, so the flag must remain off by default.
- Native search remains diagnostic-first until those parity blockers are fixed.

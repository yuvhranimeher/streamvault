# Catalog Parameter Parity Notes

Node on port 3000 remains primary. Haskell on port 3031 remains a shadow/test backend with Node fallback for unsafe, unknown, or unproven behavior.

## Scope

This slice covers only read-only catalog pagination and row APIs:

- `GET /api/movies?page=&limit=`
- `GET /api/series?page=&limit=`
- `GET /api/section/:key?page=&limit=`
- `GET /api/home-feed?limit=`

Playback, direct streams, live TV, FFmpeg, HLS, mobile HLS, player UI, poster-cache behavior, service worker behavior, and frontend design were intentionally left untouched.

## Frontend Fetch Patterns

From `public/app.js`:

- Home/bootstrap fetches `/api/movies?page=0&limit=24`.
- Home/bootstrap fetches `/api/series?summary=1&limit=24`; because no `page` is present, Node returns an array, not an envelope.
- Movie browse fetches `/api/movies?page=${p}&limit=100`.
- All-movies browse fetches `/api/movies?page=${p}&limit=${_movieBrowsePageSize}`, with `_movieBrowsePageSize = 100`.
- Series browse still has a legacy `/api/series` array fetch.
- `/api/movies/keywords` is separate and remains proxied/not part of this catalog page slice.

From `public/home.js`:

- Home feed fetches `/api/home-feed?limit=${requestedLimit}` where requested limit is `12` on weak devices and `24` otherwise.
- Row fallback fetches `/api/section/${sectionKey}?page=0&limit=12-or-24&summary=1`.
- Section grid opens with `/api/section/${sectionKey}?page=0&limit=60&summary=1`.
- Section load-more fetches `/api/section/${sectionKey}?page=${nextPage}&limit=60&summary=1`.
- Section keys used by the home page include `netflix`, `marvel`, `dc`, `trending`, `series`, `new`, `universal`, `disney`, `warner`, `hbo`, `apple`, `indian`, `anime`, `koreanDrama`, `horrorNights`, `cyberpunkScifi`, `mindfuck`, `cultClassics`, `a24`, `nostalgia90s`, `midnightCinema`, `trueCrime`, `psychThriller`, `adultAnimation`, `postApocalyptic`, `feelGood`, `darkComedy`, `timeTravel`, `spaceAi`, `crimeSyndicates`, `zombie`, `indieGems`, `hiddenMasterpieces`, `liveConcerts`, `documentaryVault`, `ghibli`, `romanceMidnight`, `comingSoon`, `drama`, `spanish`, `topRated`, `allMovies`, `recentlyAdded`, and `mostWatchedToday`.

From `public/details.js`:

- `/api/series/detail?name=...` is a details route, not part of this catalog pagination slice; it remains on Node/proxy behavior.

From `public/search.js`:

- `/api/search?...` uses one-based search paging and remains governed by the existing search parity slice.

From `public/downloads.js`:

- `/api/downloads` is outside this catalog section slice and already has separate read-only parity coverage.

Additional frontend helpers found during audit:

- `public/movies-page-fix.js` uses zero-based `/api/movies?page=&limit=72` and `/api/series?page=&limit=72`.
- `public/series-page-fix.js` uses zero-based `/api/series?page=&limit=72` for non-search series paging.
- `public/perf-overrides.js` uses zero-based `/api/movies?page=&limit=60` and `/api/series?page=&limit=60&summary=1&envelope=1`.

## Node Parameter Behavior

`/api/movies`:

- Always returns an object envelope: `{ movies, total, page, pages }`.
- Defaults to `page=0`, `limit=72`.
- Uses zero-based paging.
- Caps limit at `120`, floors positive limits at `1`.
- `limit=0`, missing limit, and malformed limit fall back to `72` because Node uses `parseInt(value || "72", 10) || 72`.
- `page=0` means first page; `page=1` means second page.

`/api/series`:

- Without `page` and without search query, returns an array. If `limit` is present, the array is sliced to that limit.
- With `page` or search query, returns an object envelope: `{ series, total, page, pages }`.
- Paged mode defaults to `page=0`, `limit=72`, zero-based.
- `summary=1` and `envelope=1` do not force the envelope unless `page` or search is present.

`/api/section/:key`:

- Always returns `{ key, items, total, page, pages }`.
- Defaults to `page=0`, `limit=24`.
- Uses zero-based paging.
- Caps limit at `120`, floors positive limits at `1`.
- `summary=1` is accepted but does not change the response shape.
- Unknown section keys use Node's default section list. For exact parity, Haskell preserves that fallback behavior.

`/api/home-feed`:

- Returns `{ ok, hero, rows }`.
- Defaults to `limit=18`.
- Limits are clamped to `6..50`.
- There is no page parameter for home-feed; row compatibility is limit-based.

## Haskell Parity Behavior

Haskell now uses Node-like integer parsing for catalog query integers:

- Leading numeric text is accepted like `parseInt`.
- Missing, malformed, or zero values fall back to the route default.
- Negative values are parsed and then clamped by the route-specific bounds.

Native Haskell catalog responses keep the Node-compatible shapes:

- Movies: `movies`, `total`, `page`, `pages`.
- Series default/no-page: root array.
- Series paged/search: `series`, `total`, `page`, `pages`.
- Section: `key`, `items`, `total`, `page`, `pages`.
- Home feed: `ok`, `hero`, `rows`.

## Section Key Compatibility

Native section parity is validated for:

- `netflix`
- `marvel`
- `dc`
- `allMovies`
- `all-movies`
- `topRated`
- `top-rated`
- `anime`
- `koreanDrama`
- `horrorNights`
- `cyberpunkScifi`
- `trending`
- `new`
- `series`

The Haskell shadow gate also permits the complete home section key set listed above once the response carries `X-StreamVault-Haskell: native-section`. Unknown section keys remain proxied/fallback to Node.

Current Node semantics treat `allMovies` and `topRated` as canonical section keys. The hyphen variants `all-movies` and `top-rated` are compatibility keys included in parity tests; Haskell keeps Node-compatible behavior for them rather than changing primary Node semantics.

## Native And Proxied Decisions

Native parameter-safe routes:

- `GET /api/movies?page=&limit=`
- `GET /api/series?page=&limit=`
- `GET /api/section/:key?page=&limit=` for the validated allow-list
- `GET /api/home-feed?limit=`

Still proxied or handled by previous slices:

- `/api/search` remains proxied by default unless the existing native-search flag is enabled.
- `/api/series/detail` remains details behavior, not catalog pagination.
- `/api/movies/keywords`, `/api/trending`, and `/api/catalog-stats` remain Node behavior.
- Playback, direct stream, live TV, FFmpeg, HLS, player UI, poster-cache, service worker, static frontend, and unknown routes remain proxied or untouched.

## Validation Artifact

The fast catalog parameter parity runner is:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\haskell-param-parity\run-catalog-param-parity-fast.ps1 -TimeoutMs 20000
```

It writes only a compact report:

- `tools/haskell-parity/out/catalog-param-fast-report.txt`

The runner compares movies, series, and section status, top-level shape, item array key, `page`, `total`, `pages`, first 12 item identities, poster/backdrop presence, type markers, and `id`/`tmdbId` where present.

`/api/home-feed` is implemented natively and audited above, but it is not a mandatory fast-runner row in this slice because the current Node primary home-feed response can exceed the fast timeout even at small limits.

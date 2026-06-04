# StreamVault Details Migration Notes

Generated during the `haskell-native-search-and-metadata` pass.

## Node Details Contract

- Route: `GET /api/details/:type/:id`.
- Media type is normalized to `movie` or `tv`.
- Node normalizes `title`/`name` and `year`, then builds the in-memory/disk key as:
  - `${mediaType}:${tmdbId || normalizedTitle || localItemName || id}:${year || localItemYear || ''}`
- Current Node has `skipDiskCache = true` in the route, so a cache miss can call TMDB, populate memory, write `detail-cache.json`, and return merged local plus TMDB metadata.
- Because of those side effects, Haskell must not call Node-equivalent TMDB logic or serve details cache misses natively.

## Observed Disk Cache Keys

- `movie:Man of Steel:2013`
- `movie:The Dark Knight:2008`
- `movie:Pirates of the Caribbean-Dead Men Tell No Tales:2017`
- `movie:Extraction:2020`
- `tv:76479:2019`

`Game of Thrones` is not currently present as an extended `detail-cache.json` hit in this workspace.

## Haskell Cache-Hit Coverage

The native Haskell route remains cache-hit only and proxies misses to Node. It now accepts these safe lookup formats:

- title only
- title plus year
- numeric `tmdbId`
- `movie:Title:Year`
- `tv:Title:Year`
- `tv:tmdbId:Year`
- `__series__Title`
- `__tmdb_id__Title`
- hyphen/colon-normalized title variants such as `Pirates of the Caribbean: Dead Men Tell No Tales` matching `Pirates of the Caribbean-Dead Men Tell No Tales`

The parity harness keeps these as Haskell-only rows because comparing against Node would risk triggering TMDB and cache writes.

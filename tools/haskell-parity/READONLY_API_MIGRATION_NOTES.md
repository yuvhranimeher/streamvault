# StreamVault Read-Only API Migration Notes

Branch: `haskell-native-search-and-metadata`

Scope for this pass: tiny read-only APIs only. Playback, live TV, FFmpeg/HLS, mobile HLS, player UI, poster-cache, service worker, and write endpoints stay on Node.

Inspected files:

- `server.js`
- `routes/dashboard.js`
- `middleware/tracker.js`
- `public/app.js`
- `public/dashboard.js` was checked and is not present

## Endpoint Audit

| Endpoint | Method | Read-only/write | Response shape | Data source | Decision | Reason |
| --- | --- | --- | --- | --- | --- | --- |
| `/__haskell-health` | GET | Read-only | `{ ok, runtime, server }` | Haskell process | Already native | Existing Haskell-only health route; no catalog load. |
| `/api/health` | GET | Read-only | `{ ok, runtime, shadow, server }` | Haskell process | Already native | Existing Haskell-only health route; no catalog load. |
| `/api/dashboard/ping` | GET | Read-only | `{ ok, ts, uptime, nodeVersion, memory, loadAvg, freemem, totalmem }` | Runtime status | Migrated native | Pure status payload. Values are runtime-local; parity checks shape/types rather than exact timestamps or process counters. |
| `/api/dashboard/stats` | GET | Read with mutation | `{ ts, uptime, uptimeStr, memory, nodeVersion, activeUsers, users, activeStreams, streamCount, avgResponseMs, recentPerf, errorCount, recentErrors, topContent, hourlyWatches, totalWatches }` | `middleware/tracker.js` in-memory sessions, streams, perf/errors, watch event logs | Keep proxied | `tracker.getStats()` calls `purgeStaleSessions()`, mutating in-memory session state, and depends on Node-only middleware state. |
| `/api/history` | GET | Read-only | watch history object keyed by media id | `watch-history.json` / Node `watchHistory` memory | Migrated native | Haskell reads `watch-history.json` per request. Node write endpoints persist to the same file, so the read route can stay fresh without migrating writes. |
| `/api/history` | POST | Write | `{ ok: true }` or validation error | request body, `watch-history.json`, Node memory | Keep proxied | Mutates watch progress/history and saves the file. |
| `/api/history/:id` | DELETE | Write | `{ ok: true }` or validation error | URL id, `watch-history.json`, Node memory | Keep proxied | Deletes history entry and saves the file. |
| `/api/version` | GET | Read-only | `{ ok, version, time }` | static route marker plus current time | Migrated native | Tiny status/config endpoint with no external IO beyond current time. |
| `/api/catalog-stats` | GET | Read-only but potentially heavy | `{ ok, homepageUntouched, existingMovies, existingSeries, massiveMovies, massiveSeries, massiveTotal }` | in-memory lists, `loadMassiveCatalog()` | Keep proxied | Calls massive catalog loading and is not a tiny status route. |
| `/api/media-info/:id` | GET | Read-only but heavy | `{ audioTracks, subtitleTracks, videoCodec, videoIndex, duration, container }` or fallback | local media file, `ffprobe` via `getCachedMediaInfo()` | Keep proxied | Spawns/proxies through ffprobe and is playback metadata. |
| `/api/duration/:id` | GET | Read-only but heavy | `{ duration }` | local media file, `ffprobe` via `getCachedMediaInfo()` | Keep proxied | Uses the same ffprobe path as media-info. |
| `/api/qualities/:id` | GET | Read-only, playback-adjacent | `{ available, native, sizeMB }` | `fileIndex`, local media stat | Keep proxied | Media/playback-adjacent endpoint; not part of this safe tiny status/history pass. |
| `/api/subtitles/:id` | GET | Read-only directory scan | array of `{ index, label, lang, src }` | local subtitle files near media | Keep proxied | Subtitle route family is playback-adjacent; serving and embedded subtitle routes can read media or spawn FFmpeg. |
| `/subtitles/:id/:trackIdx?` | GET | Read-only file read | subtitle text/VTT | local subtitle file | Keep proxied | Player subtitle delivery route; not migrated. |
| `/subtitles/:id/embedded/:streamIdx.vtt` | GET | Read-only but heavy | `text/vtt` | local media file, FFmpeg | Keep proxied | Spawns FFmpeg to extract embedded subtitles. |
| `/api/ftp/media-info`, `/api/ftp/info` | GET | Read-only but heavy | remote media metadata plus play URL fields | remote URL, ffprobe | Keep proxied | Calls `getCachedMediaInfo()` on remote media and can be slow/heavy. |
| `/api/ftp/subtitle/:track.vtt` | GET | Read-only but heavy | `text/vtt` | remote media URL, FFmpeg | Keep proxied | Spawns FFmpeg and is playback subtitle delivery. |
| `/api/title-details` | GET | Read-only with external/cache side effects | extended details object | TMDB/OMDB/cache helpers | Keep proxied | Can call external APIs and update caches. |
| `/api/episode-titles` | GET | Read-through cache write | array of episode title metadata | TMDB plus `episode-title-cache.json` | Keep proxied | May call TMDB and writes cache entries. |
| `/api/channels` | GET | Read-only | channels array | `channels.json` | Already native | Existing safe catalog/static-data route. |
| `/api/channels/reload` | POST | Write/reload | reload status | `channels.json`, Node memory | Keep proxied | Explicit reload/mutation endpoint. |

## Progress Endpoint Notes

No dedicated server-side read-only `/api/progress` endpoint was found. Frontend progress in `public/app.js` is primarily `localStorage` (`sv_progress`), while server-side watch progress is represented by `/api/history` writes and the read-only `/api/history` snapshot.

## Native Routes Added In This Pass

- `GET /api/dashboard/ping`, marker `native-dashboard-ping`
- `GET /api/history`, marker `native-history`
- `GET /api/version`, marker `native-version`

These routes remain gated by the Haskell shadow path. Node on port 3000 remains primary and falls back to the original Node handlers if the Haskell shadow request fails, times out, returns the wrong status, or lacks the expected native marker.

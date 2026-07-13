# Hostinger frontend deployment

`hostinger/` is the production frontend source of truth for `https://streamvault.fit`.
The live domain returns the active files and version markers from this directory. The
repository has no GitHub Actions workflow or checked-in Hostinger project setting;
Hostinger's deployment source/subdirectory must therefore remain set to `hostinger/`
(or its contents must be deployed to `public_html`).

`public/` is the legacy frontend served by the Mac Mini backend. It is deliberately
not copied into `hostinger/`, and existing files are retained until the Hostinger
deployment has been verified in production.

Hostinger's current deployment hook has one compatibility exception: it publishes
`public/sw.js` at `/sw.js`. That file is therefore an exact verified mirror of
`hostinger/sw.js`; the Hostinger build fails if the two workers diverge.

## Build and verification

From the repository root:

```sh
npm run build:hostinger
```

The build reads and writes only within `hostinger/`. It validates the complete
frontend inventory, local channel logos, manifest, static JSON, and initial poster
URLs, then deterministically rebuilds `boot-search-index.json` from
`home-feed.json`. It never copies backend code, media, caches, secrets,
`node_modules`, or server data.

## Request ownership

| Request class | Production owner | Examples |
| --- | --- | --- |
| HTML, CSS, JavaScript and SPA routes | Hostinger | `/`, `/styles.css`, `/app-v3.js` |
| Logos, icons, placeholders and manifest | Hostinger | `/assets/`, `/fallback.webp`, `/manifest.webmanifest` |
| Static homepage, search and channel metadata | Hostinger | `/home-feed.json`, `/boot-search-index.json`, `/channels.json` |
| Initial poster/backdrop images | Original image CDN, cached by the service worker | `https://image.tmdb.org/...` |
| APIs and dynamic catalog refreshes | Mac Mini through the backend origin | `https://backend.streamvault.fit/api/...` |
| Playback, Range/206 and media probing | Mac Mini through the backend origin | `/stream/`, playback and media-info API routes |
| HLS, subtitles, audio operations and Live TV relay | Mac Mini through the backend origin | `.m3u8`, `/subtitles/`, `/live-relay/` |
| Download catalog and files | Mac Mini through the backend origin | `/api/downloads`, `/download/:id` |

The backend origin is configured once in `runtime-config.js`. Backend paths are
never handled by Hostinger's SPA fallback.

## Cache boundary

- HTML navigations are network-first with a cached shell fallback.
- CSS, JavaScript, fonts, icons and local images are stale-while-revalidate.
- Static homepage/search/channel JSON is network-first with cached fallback.
- TMDB posters are stale-while-revalidate with a bounded browser cache.
- API, downloads, video, audio, Range requests, HLS playlists/segments, subtitles,
  stream/proxy routes and Live TV are network-only.
- `index.html` and `sw.js` are served with no-cache/no-store headers.

## Production checks

After deployment, confirm `https://streamvault.fit/sw.js` has a no-cache/no-store
response header. If Hostinger's CDN overrides `.htaccess`, add the equivalent cache
rule in hPanel and purge the Hostinger/Cloudflare cache once for this release.

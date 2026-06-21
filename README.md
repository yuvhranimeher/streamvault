# StreamVault / Insomnia Tapes

StreamVault is a self-hosted, Netflix-style streaming website project for movies, series, live TV, and software/game downloads.

Production domain:

- https://insomniatapes.lol

Repository:

- mahmud2248/streamvault

---

## 1. Project Purpose

StreamVault is designed as a personal streaming platform that can:

- index large movie and series catalogs
- scan BDIX/FTP media servers
- display a Netflix-like homepage
- stream movies and shows
- support live TV channels
- provide a software/game download hub
- load posters and metadata
- keep desktop playback fast through direct play
- use mobile HLS/FFmpeg only when needed
- allow future backend migration from Node.js to Haskell

The project focuses on speed, large catalog handling, direct playback, mobile compatibility, and clean frontend presentation.

---

## 2. Main Technology Stack

### Backend

- Node.js
- Express.js
- CommonJS modules
- JSON catalog files
- Optional SQL/database migration work
- Experimental Haskell backend migration

### Frontend

- HTML
- CSS
- Vanilla JavaScript
- Service Worker
- Progressive/lazy rendering
- TMDB poster optimization
- Mobile-friendly layout

### Media Tools

- FFmpeg
- FFprobe
- HLS.js
- Native browser video playback

### Network / Deployment

- Windows 10 server
- Local Node server
- Cloudflare Tunnel for public access
- BDIX/FTP media sources
- GitHub repository for version control

---

## 3. Server Hardware Plan

Current main server:

- 2011 Mac Mini
- Windows 10
- Runs main website
- Runs Node.js backend
- Handles catalog/API/frontend/direct play
- Should avoid heavy FFmpeg workloads

Planned transcoding server:

- M1 Mac Mini
- 16GB RAM
- 256GB SSD
- Dedicated for mobile HLS/transcoding/cache
- Used for popular pre-transcoded content

Architecture goal:

- 2011 Mac Mini = website/API/catalog/direct-play server
- M1 Mac Mini = mobile transcoding/HLS/cache server
- Desktop users = direct play
- Mobile users = optimized HLS when needed

---

## 4. Core Project Rule

Desktop playback must direct-play original files whenever possible.

FFmpeg should not run unnecessarily for desktop users.

Mobile playback may use FFmpeg/HLS only when required.

Playback and FFmpeg routes are the riskiest parts of the project and should be changed last.

Stable playback checkpoint:

- `860d4f7` (`stable-playback-20260621`) is the stable playback base.
- Do not change media playback/source logic unless a specific title fails.
- Future subtitle, audio, search, and UI work must preserve this playback behavior.

---

## 5. Main Files

### Backend

- `server.js`
- `package.json`
- `package-lock.json`

### Frontend

- `index.html`
- `styles.css`
- `app.js`
- `home.js`
- `search.js`
- `details.js`
- `player.js`
- `downloads.js`
- `livetv.js`
- `boot.js`
- `sw.js`

### Catalog / Cache Files

- `catalog.json`
- `home-feed.json`
- `section-cache.json`
- `poster-cache.json`
- `episode-title-cache.json`
- `popular-titles-cache.json`
- `channels.json`
- `rejected-media.json`

### Crawler / Utility Scripts

- `discover-servers.js`
- `ftp-scan.js`
- `deep-media-crawler.js`
- `check-root.js`
- `scan-media-catalogs.js`
- `make-integration-list.js`
- `migrate-json-to-sql.js`
- `organize-files.js`
- `build-clean-catalog.js`

---

## 6. Main Features

### Movies

StreamVault supports movie browsing, metadata display, poster loading, search, playback, and homepage sections.

Movie APIs include:

- `/api/movies`
- `/api/details/movie/:id`
- `/api/search`
- `/api/section/:id`

### Series

Series support includes:

- show cards
- seasons
- episodes
- episode titles
- episode thumbnails
- series metadata
- playback routing

Series APIs include:

- `/api/series`
- `/api/details/series/:id`

### Homepage

The homepage is designed as a curated Netflix-style discovery page.

Important homepage rows include:

- Netflix Originals
- Marvel Studios
- DC
- Trending Now
- Series
- New to StreamVault
- Universal Pictures
- Disney
- Warner Bros
- HBO
- Apple TV+
- Indian Movies & Drama
- Anime
- Korean Drama
- Horror Nights
- Cyberpunk & Sci-Fi
- Mindfuck Movies
- Cult Classics
- A24 Collection
- 90s Nostalgia
- Midnight Cinema
- True Crime
- Psychological Thriller
- Adult Animation
- Post-Apocalyptic
- Feel Good Movies
- Dark Comedy
- Time Travel
- Space & AI
- Crime Syndicates
- Zombie Universe
- Indie Gems
- Hidden Masterpieces
- Live Concerts
- Documentary Vault
- Studio Ghibli
- Romance After Midnight
- Recently Added
- Most Watched Today
- Continue Watching
- Top Rated
- All Movies

Important rule:

Homepage rows must not be removed accidentally during backend/frontend changes.

### Search

Search is designed to work across the full catalog, including titles not shown on the homepage.

Search goals:

- fast results
- movie and series support
- typo/fuzzy-friendly behavior
- phrase priority
- clean title matching
- avoid showing raw FTP junk filenames

### Details Page

Details pages may include:

- title
- poster
- backdrop
- overview
- year
- rating
- runtime
- language
- genre
- cast
- crew
- director
- production companies
- trailers
- similar titles
- more by director
- episode list for series
- playback information

### Player

The player supports:

- direct file playback
- HLS playback
- mobile optimized playback
- resume/continue watching
- watch progress
- subtitles where available
- audio track handling where available
- live TV playback
- HLS.js fallback

Critical rule:

Do not break direct desktop playback.

### Live TV

Live TV uses:

- `channels.json`
- `livetv.js`
- `/api/channels`

Supported channel categories include:

- Sports
- News
- Entertainment

Live TV cards can show channel names, colors, logos, and stream URLs.

### Software / Download Hub

The download hub supports software, games, APKs, archives, ISO files, console files, and other downloadable items.

Important file:

- `downloads.js`

Download hub goals:

- list large software catalogs
- avoid rendering too many cards at once
- use pagination/progressive rendering
- redirect downloads instead of proxying files
- keep server bandwidth low
- avoid storing every external file locally

Download route:

- `/download/:id`

---

## 7. Data Pipeline

Basic StreamVault data flow:

```text
BDIX/FTP source
-> crawler/scanner
-> raw catalog
-> title cleanup
-> metadata enrichment
-> poster cache
-> dedupe
-> API response
-> frontend rendering
-> playback/download
```

Catalog cleanup goals:

- remove duplicates
- normalize dirty filenames
- extract years
- reject invalid files
- prefer better posters
- prefer higher quality sources
- keep homepage sections clean

---

## 8. Poster System

Poster system goals:

- load TMDB posters quickly
- cache poster images
- use smaller image sizes for mobile
- avoid broken poster URLs
- fallback to backdrop when poster is missing
- fallback to placeholder when both are missing
- avoid heavy blur effects
- keep scrolling smooth

Important files:

- `poster-cache.json`
- `sw.js`
- `app.js`
- `details.js`

---

## 9. Service Worker

Service worker file:

- `sw.js`

Responsibilities:

- cache static JS/CSS assets
- cache poster requests
- briefly cache home feed API
- clear stale cache versions
- improve repeat load speed

When frontend assets change, cache version should be updated.

---

## 10. API Routes

Important API routes:

- `/api/health`
- `/api/home-feed`
- `/api/movies`
- `/api/series`
- `/api/search`
- `/api/section/:id`
- `/api/details/:type/:id`
- `/api/channels`
- `/api/live/test/:id`
- `/api/downloads`
- `/download/:id`
- `/poster-cache`

---

## 11. Performance Rules

StreamVault handles large catalogs, so performance is critical.

Rules:

- never render entire huge catalogs at once
- use pagination
- use progressive rendering
- use lazy-loaded posters
- use poster cache
- avoid blocking the browser main thread
- avoid loading 10k+ cards in one render
- avoid unnecessary FFmpeg
- keep homepage rows limited and curated
- keep full catalog searchable
- use mobile-safe scrolling
- keep horizontal overflow disabled on mobile details pages

---

## 12. Mobile Rules

Mobile goals:

- vertical-only scrolling
- no sideways page movement
- optimized posters
- HLS playback where needed
- smooth details page
- stable bottom navigation
- safe layout for iPhone Safari
- no heavy background effects

---

## 13. Haskell Migration Plan

Long-term goal:

Move backend APIs from Node.js to Haskell safely while preserving exact frontend API compatibility.

Migration order:

1. Downloads API
2. Movies API
3. Home-feed API
4. Series API
5. Search API
6. Section APIs
7. Details/TMDB APIs
8. Live TV APIs
9. Playback/direct stream routes
10. FFmpeg/HLS routes last

Reason:

Playback and FFmpeg are the riskiest systems and must remain stable until all safer APIs are proven.

Current strategy:

- Node.js remains production backend
- Haskell runs as shadow/test backend
- compare JSON parity before switching frontend
- migrate one API group at a time
- never break working Node routes

---

## 14. Git Branch Strategy

The project uses branches for testing risky changes.

Common branch types:

- stable master branch
- Haskell migration branches
- frontend shadow API branches
- backend parity testing branches
- safe tool/prototype branches

Rule:

Do not merge large experimental branches into master unless tested.

For small safe changes like README updates, commit directly to master or cherry-pick only the specific README commit.

---

## 15. Development Rules

When changing this project:

- preserve playback
- preserve desktop direct play
- preserve mobile streaming
- preserve live TV
- preserve search
- preserve details pages
- preserve TMDB metadata
- preserve downloads section
- preserve continue watching
- preserve watch history
- preserve homepage rows
- preserve service worker behavior
- preserve poster cache
- preserve UI design
- preserve mobile layout
- preserve existing APIs

Avoid:

- deleting homepage sections
- changing all frontend files blindly
- forcing FFmpeg on desktop
- rendering huge catalogs all at once
- showing raw FTP filenames
- polluting Marvel/DC/Netflix rows
- breaking poster cache
- breaking mobile scrolling
- merging experimental branches into master without testing

---

## 16. Install

```bash
npm install
```

---

## 17. Run

```bash
npm start
```

Then open:

```text
http://localhost:3000
```

---

## 18. Health Check

```bash
curl http://127.0.0.1:3000/api/health
```

---

## 19. Common Local Test URLs

```text
http://127.0.0.1:3000
http://127.0.0.1:3000/api/home-feed
http://127.0.0.1:3000/api/movies
http://127.0.0.1:3000/api/series
http://127.0.0.1:3000/api/channels
http://127.0.0.1:3000/api/downloads
```

---

## 20. Project Status

StreamVault is an active personal streaming website project.

Current production direction:

- Node.js server remains primary
- Haskell backend migration is experimental/shadow
- homepage and playback stability are highest priority
- direct desktop playback must remain intact
- mobile HLS should be optimized and cached
- software/download hub should stay redirect-based
- full catalog search should remain available
- curated homepage should remain fast and clean

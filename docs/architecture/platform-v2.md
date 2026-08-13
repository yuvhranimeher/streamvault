# StreamVault Platform v2

Platform v2 is an API-first migration beside the existing Node/Express server. It does not replace the production server in one jump. Phoenix handles concurrency, catalog reads, discovery, progress, and session state. Haskell owns deterministic playback policy and byte-range validation. Node remains the executor for local files, FFmpeg, FTP proxying, subtitles, and live relay until parity is proven route by route.

## Goals

- Preserve the existing browser contract while backend internals change.
- Keep direct play as the first choice; never transcode compatible media.
- Make catalog reloads atomic so requests see either the old complete generation or the new complete generation.
- Bound page sizes, session lifetime, request rates, and remote planner timeouts.
- Allow Phoenix to operate when the planner is unavailable by using the same conservative policy locally.
- Produce measurable shadow-parity evidence before any route is moved in production.
- Add no new browser language or frontend framework. The platform directory contains Elixir only.

## Component model

| Component | Runtime | Responsibility |
|---|---|---|
| `streamvault_core` | BEAM | Canonical media model, normalization, search scoring, pagination, section rules |
| `streamvault_catalog` | BEAM | JSON ingestion, immutable ETS generations, inverted index, hot reload |
| `streamvault_playback` | BEAM | Planner client, fallback policy, expiring playback sessions |
| `streamvault_edge` | Phoenix/Bandit | HTTP contract, compatibility mapping, rate limits, history, tracing, metrics |
| `media-planner` | GHC/Warp/Servant | Pure direct/remux/transcode/reject policy and byte-range parsing |
| Existing `server.js` | Node/Express | Production playback execution and routes not yet migrated |

## Request paths

### Catalog request

1. Bandit accepts the connection and Phoenix assigns request and client identifiers.
2. The limiter applies a fixed per-client budget.
3. The controller asks the catalog facade for the active generation.
4. The facade reads immutable ETS tables without calling the catalog owner process.
5. Domain records are converted to the current frontend JSON shape.
6. When shadow mode is enabled, the response is compared asynchronously with Node.

### Catalog reload

1. The catalog GenServer reads and validates the JSON file.
2. Every crawler record is normalized into a canonical media struct.
3. New anonymous ETS item, kind, and token tables are built.
4. A single persistent-term pointer swap publishes the generation.
5. The previous tables remain readable for five seconds, then their owner deletes them.
6. Failed loads leave the previous complete generation active and mark readiness as stale.

### Playback plan

1. Phoenix resolves the media id to its current source URL.
2. Probe facts and browser capabilities are normalized.
3. The Haskell planner selects direct, remux, transcode, or reject.
4. A two-second failure budget prevents planner trouble from delaying playback.
5. If the service fails, the Elixir fallback returns a conservative equivalent decision.
6. Phoenix opens a bounded, expiring session and returns the plan.
7. The existing Node routes may execute remux/transcode until that final migration phase.

## Catalog memory model

The active generation contains three ETS tables:

- `items`: media id to canonical media record;
- `kinds`: movie/series to media ids;
- `tokens`: normalized token to media ids.

Tables are public for concurrent reads but are owned by the supervised catalog server. Writers never mutate the active generation. That avoids partially updated search results and keeps read traffic outside the GenServer mailbox.

## Search ranking

Search is deliberately explainable. It combines:

- exact normalized title;
- title prefix;
- exact phrase in searchable metadata;
- exact title-token matches;
- metadata-token matches;
- token-prefix matches;
- all-term coverage;
- small rating and artwork quality bonuses.

The inverted index reduces the candidate pool before scoring. Results then use a stable sort by score, rating, year, and title.

## Failure behavior

| Failure | Behavior |
|---|---|
| Catalog file missing at boot | Process starts degraded; readiness is 503; reload keeps retrying |
| New catalog invalid | Previous generation stays active; status becomes stale |
| Haskell planner unavailable | Elixir fallback plans locally; telemetry labels planner as `elixir` |
| Legacy shadow request fails | User response is unaffected; a shadow error metric increments |
| Client exceeds rate budget | JSON 429 with retry delay |
| Session becomes idle | Sweeper removes it after the configured TTL |
| Unsupported media facts | Planner selects transcode or reject; it never guesses direct play |

## Why this is not thousands of generated files

File count and file length are not architecture metrics. Huge generated modules make review, compilation, and failure isolation worse. This version uses small bounded modules, explicit contracts, and multiple independently testable OTP applications. It is intentionally larger in capability and separation, not artificial repetition.

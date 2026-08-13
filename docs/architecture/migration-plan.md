# Route-by-route migration plan

The production Node backend stays authoritative until a route completes every gate below. The Phoenix edge runs on a separate port or hostname during validation.

## Gates

1. **Contract:** OpenAPI shape exists and contract tests pass.
2. **Fixture:** representative local, FTP, incomplete, and malformed records are covered.
3. **Shadow:** Phoenix executes without serving user traffic and compares semantic output with Node.
4. **Load:** latency, scheduler queue, memory, and error budgets pass at expected concurrency.
5. **Canary:** a small traffic percentage is served by Phoenix with immediate rollback available.
6. **Primary:** Phoenix becomes authoritative for the route.
7. **Retire:** Node implementation is removed only after an observation window.

## Sequence

| Phase | Routes | Risk | Exit evidence |
|---|---|---:|---|
| 0 | `/health`, `/ready`, `/metrics`, `/api/version` | Low | stable deploy and monitoring |
| 1 | `/api/catalog-stats`, `/api/search` | Low | parity on counts and ranked fixtures |
| 2 | `/api/movies`, `/api/series`, `/api/section/:key`, `/api/home-feed` | Medium | frontend screenshots and response parity |
| 3 | `/api/history` | Medium | client isolation and persistence decision |
| 4 | `/api/playback/plan/:id` | Medium | device/codec matrix passes |
| 5 | media info, duration, qualities, subtitles | High | ffprobe and subtitle parity |
| 6 | direct local/FTP streaming | High | byte-range, seek, disconnect, and throughput tests |
| 7 | remux/transcode/HLS | Critical | soak test and strict resource admission |
| 8 | live relay and watch party | Critical | reconnect, cleanup, fan-out, and upstream failure tests |

## Shadow comparison

Set `SHADOW_ENABLED=true` only on the Phoenix edge. For selected GET routes, the plug lets the Phoenix response return normally and starts an asynchronous request to `LEGACY_ORIGIN`. Both values are canonicalized and hashed. The comparison emits telemetry without adding latency to the user request.

Exact semantic equality is expected for stable contract fields. Fields such as timestamps, generated ids, and ranking changes should be normalized in a route-specific comparator before a route is promoted.

## Rollback

- Keep Cloudflare route weights or origin rules outside the applications.
- A rollback changes routing back to Node; it does not require a database rollback.
- Catalog v2 reads the same generated JSON as Node and does not rewrite it.
- The planner makes decisions but does not mutate source media.
- Do not migrate playback execution until FFmpeg admission control and process cleanup are implemented and load-tested.

## Data decisions still required

The current v2 history store is intentionally in-memory and client-scoped. Before the history route becomes authoritative, choose a durable store and define identity. Recommended options are PostgreSQL for account history or SQLite on the single host for anonymous/local use. Do not silently treat an IP-derived client id as a permanent identity.

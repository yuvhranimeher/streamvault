# Platform v2 runbook

## Local launch

The simplest complete launch uses containers:

```bash
docker compose -f compose.platform.yaml up --build
```

Endpoints:

- Phoenix edge: `http://127.0.0.1:4000`
- Haskell planner: `http://127.0.0.1:4100`
- Existing Node backend remains on `http://127.0.0.1:3000`

The checked-in compose secrets are local-only. Replace `SECRET_KEY_BASE` and `ADMIN_KEY` before any non-local deployment.

## Native development

Phoenix:

```bash
cd platform
mix setup
mix phx.server
```

Planner:

```bash
cabal build streamvault-media-planner
cabal run streamvault-media-planner
```

## Fast checks

```bash
npm run check
npm test
cd platform && mix quality
cabal test all
```

## Smoke checks

```bash
curl --fail http://127.0.0.1:4000/health
curl --fail http://127.0.0.1:4000/ready
curl --fail 'http://127.0.0.1:4000/api/search?q=arrival'
curl --fail http://127.0.0.1:4100/health
```

Playback planning example:

```bash
curl --fail \
  -H 'content-type: application/json' \
  -H 'x-client-id: smoke-test' \
  -d '{"probe":{"container":"mp4","videoCodec":"h264","audioCodec":"aac","height":1080,"hasRange":true},"capability":{"containers":["mp4"],"videoCodecs":["h264"],"audioCodecs":["aac"],"supportsRange":true}}' \
  http://127.0.0.1:4000/api/playback/plan/MEDIA_ID
```

## Environment

| Variable | Service | Default | Purpose |
|---|---|---|---|
| `PORT` | Both | 4000/4100 | Listen port |
| `HOST` | Both | localhost/0.0.0.0 | Public host or bind host |
| `SECRET_KEY_BASE` | Edge | required in prod | Phoenix signing secret |
| `CATALOG_PATH` | Edge | `/data/catalog.json` | Generated catalog |
| `HOME_FEED_PATH` | Edge | `/data/home-feed.json` | Reserved feed compatibility input |
| `PLANNER_URL` | Edge | `http://media-planner:4100` | Haskell planner base URL |
| `LEGACY_ORIGIN` | Edge | `http://legacy:3000` | Node shadow target |
| `SHADOW_ENABLED` | Edge | false | Asynchronous parity checks |
| `ADMIN_KEY` | Edge | none | Protects catalog reload |

## Signals

- `/ready` must be 200 before traffic is sent to an edge instance.
- `streamvault_catalog_items` must remain above zero.
- `planner="elixir"` is functional fallback, but a sustained ratio above 20% means the Haskell service is unhealthy or slow.
- A growing Phoenix endpoint duration sum without matching request growth indicates latency regression.
- Shadow mismatches are investigation signals, not automatic rollout blockers until dynamic fields are normalized.

## Catalog recovery

1. Check `/ready` and application logs for the exact loader error.
2. Validate that `CATALOG_PATH` exists inside the container and is readable.
3. Validate JSON without modifying it.
4. Replace the bad generated file using the existing crawler pipeline.
5. Call `POST /api/admin/catalog/reload` with `x-admin-key`.
6. Confirm generation, total count, and readiness changed.

An invalid reload does not delete the active generation.

## Planner recovery

1. Confirm the edge is labeling plans with `planner=elixir`.
2. Check `http://media-planner:4100/health` from the edge network.
3. Inspect planner logs for JSON decode or policy failures.
4. Restart only the planner container if necessary; edge traffic can continue on fallback.
5. Confirm new plans return `planner=haskell`.

## Production caution

This branch does not claim that the playback executor has migrated. Keep the current Node streaming, live-relay, subtitle, and FFmpeg routes in service. Those routes own expensive processes and network edge cases and must move only after the later migration gates pass.

# Playback Shadow Freeze Baseline

This document freezes the accepted read-only playback shadow baseline for the
StreamVault Haskell migration. It is a review and validation baseline only.

## Accepted Shadow Planner Contract

The accepted playback planner shadow contract is represented by:

- `playback-planner-fixtures.json`
- `PlaybackShadowPlanner.hs`
- `playback_shadow_planner_js.js`
- `playback_shadow_planner_gate.py`
- `playback_js_vs_hs_shadow_compare.py`

The frozen planner expectations are:

- desktop movie FTP playback remains `direct`
- mobile compatibility playback may use `hls` only when required
- series episode playback remains `direct`
- live TV `.m3u8` playback remains `live`
- missing `streamUrl` remains invalid
- desktop playback must not automatically transcode

## Accepted Route Contract Fixtures

The accepted route contract fixtures are in `playback-route-contract-fixtures.json`.
They cover:

- desktop FTP direct JSON planning
- mobile HLS planning when required
- movie metadata resolution
- raw FTP stream metadata
- local playback metadata
- series episode playback
- mobile series episode HLS planning
- live TV m3u8 playback
- invalid missing `streamUrl`
- invalid unknown route target
- invalid unsupported `clientType`
- invalid unsupported `sourceType`
- invalid unsafe/non-http `streamUrl`
- invalid missing `routeTarget`
- invalid missing `sourceType`
- invalid missing `clientType`

## Freeze Baseline Extension: Inactive Route Fixture Coverage V1

This baseline is extended with inactive route fixture coverage v1. The extension
adds read-only coverage auditing for route fixture breadth only; it does not add
active HTTP routes, does not wire Haskell route code into the server, does not
start production services, and does not call FTP/live URLs or FFmpeg.

## Freeze Baseline Extension: Inactive Route Response Envelope V1

This baseline is also extended with inactive route response envelope v1. The
extension defines read-only decision fields for route, source type, client type,
playback mode, stream URL, transcode flags, status code, error code, reason, and
safety flags. Invalid fixtures must use the frozen error taxonomy documented in
`inactive-playback-route-response-envelope.md`.

The response envelope is produced only by shadow tools and inactive Haskell/JS
comparators. It does not add active HTTP routes, does not wire Haskell route code
into the production server, does not modify runtime playback behavior, does not
touch production frontend playback code, and does not call FTP/live URLs or
FFmpeg.

## Freeze Baseline Extension: Inactive Route Adapter Tests V1

This baseline is further extended with inactive route adapter tests v1. The
extension adds local request/response adapter fixtures and JS/Haskell shadow
adapters that normalize `method`, `path`, `query`, and `body` fixture inputs
into the inactive response envelope. It remains shadow-only: no active HTTP
routes are registered, no Haskell adapter is imported by the server, no runtime
playback code changes, no frontend playback code changes, no network calls, and
no FFmpeg calls.

## Freeze Baseline Extension: Inactive Route Response Body Parity V1

This baseline is further extended with inactive route response body parity v1.
The extension adds route-level response payload fixtures, JS/Haskell shadows,
an exact comparator, an envelope gate, a coverage audit, and a safety gate. It
models stable payload shapes for movie JSON, FTP JSON, local JSON, FTP raw byte
metadata, series JSON, live HLS metadata, and error JSON without starting a
server or opening any fixture URL.

This extension does not change desktop direct-play behavior, mobile HLS
behavior, production runtime playback code, production frontend playback code,
active route registration, workflow permissions, or FFmpeg/network behavior.

## Freeze Baseline Extension: Inactive Route Status/Header Parity V1

This baseline is further extended with inactive route status/header parity v1.
The extension adds route-level status and response header fixtures, JS/Haskell
shadows, an exact comparator, an envelope gate, a coverage audit, and a safety
gate. It models deterministic status codes and lowercase sorted headers for
JSON responses, raw byte metadata, live HLS metadata, rejected adapter results,
unsafe placeholder URLs, and method/status edge cases.

This extension does not change desktop direct-play behavior, mobile HLS
behavior, production runtime playback code, production frontend playback code,
active route registration, workflow permissions, or FFmpeg/network behavior.

## Accepted Inventory Schema

The accepted route inventory is `playback-route-shadow-contract-inventory.json`.
The frozen route targets are:

- `/api/playback/local`
- `/api/playback/ftp`
- `/api/playback/movie`
- `/api/ftp/raw`
- `live TV m3u8 playback`
- `series episode playback`

## Accepted CI Gates

Reviewers should expect these gates to pass:

```sh
npm run test:playback-shadow
npm run test:playback-shadow-review
npm run collect:playback-shadow-artifacts
npm run report:playback-shadow-artifacts
npm run report:playback-shadow-readiness
```

The underlying read-only gates include planner fixture validation, Haskell shadow
planner validation, JS/Haskell planner comparison, route inventory schema,
route fixture schema, route crosscheck, JS/Haskell route comparison, route full
gate, inactive route fixture coverage audit, inactive route response envelope
gate, inactive route adapter comparator, inactive route adapter safety gate,
inactive route response body comparator, response body envelope gate, response
body fixture coverage audit, response body safety gate, inactive route
status/header comparator, status/header envelope gate, status/header fixture
coverage audit, status/header safety gate, workflow safety,
artifact manifest validation, and readiness indexing.

## Accepted Workflow Safety Rules

The GitHub Actions workflow must remain read-only:

- triggers only `pull_request` and `workflow_dispatch`
- `permissions: contents: read`
- no secrets
- no write permissions
- no PR comment posting
- no release job
- no production server startup

Artifact upload and `$GITHUB_STEP_SUMMARY` are accepted because they do not
require write permissions to repository contents or pull requests.

## Accepted Artifact And Review Process

The accepted artifact bundle is `playback-shadow-review-pack`. It contains:

- CI report
- PR summary
- review-pack report
- workflow safety report
- JS/Haskell planner compare report
- route contract compare report
- manifest

Reviewers should start with `README.md`, then inspect
`playback-shadow-artifact-inspection.md`, `playback-shadow-review-checklist.md`,
and the latest readiness index report.

## What Is Frozen

- fixture shape and expected planner decisions
- route inventory target list
- route fixture coverage
- inactive route response envelope v1 and error taxonomy
- inactive route adapter tests v1
- inactive route response body parity v1
- inactive route status/header parity v1
- JS/Haskell comparator behavior
- read-only CI/review/artifact workflow
- safety invariants listed in this document
- accepted npm scripts listed above

## What Is Not Implemented Yet

- no active HTTP routes
- no inactive Haskell HTTP routes yet
- no active response envelope route
- no production Haskell playback route wiring
- no production traffic to Haskell playback code
- no frontend playback behavior changes

## What Must Not Change Without A New Baseline

- desktop direct-play original FTP behavior
- mobile HLS only when required
- no automatic desktop transcoding
- no production server start in tests
- no FFmpeg calls
- no FTP or live URL calls
- no runtime playback changes
- no production frontend playback changes
- no secrets or write permissions
- no PR comment posting

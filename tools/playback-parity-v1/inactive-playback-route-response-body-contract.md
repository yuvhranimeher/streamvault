# Inactive Playback Route Response Body Contract

This contract defines the next shadow-only route-level playback parity layer.
It sits after inactive adapter normalization and before any future active route
wiring. The layer compares JS and Haskell decisions for the response body shape
that each inactive playback route would return, using local fixtures only.

## Scope

The response body shadow reads route-level fixtures and returns one response
envelope per fixture. The envelope preserves the existing inactive route safety
fields and adds a `responsePayload` object that models the route response body.

The shadow layer covers:

- `/api/playback/movie`
- `/api/playback/ftp`
- `/api/playback/local`
- `/api/ftp/raw`
- `series episode playback`
- `live TV m3u8 playback`

## Responsibilities

The route response body shadow must:

- parse safe local route response fixtures
- validate `routeTarget`, `sourceType`, `clientType`, `playbackMode`, and
  `streamUrl`
- preserve desktop direct playback as direct
- preserve mobile HLS only when requested by fixture compatibility
- preserve raw byte-stream metadata without starting any stream
- preserve live HLS metadata without calling a live URL
- return a response envelope with deterministic `responsePayload`
- match JS and Haskell output exactly after JSON normalization

## Response Shapes

The shadow response payloads are intentionally minimal and deterministic:

- `movie-json`: `ok`, `streamUrl`, `sourceType`, `clientType`, `playbackMode`
- `ftp-json`: `ok`, `src`, `mode`, `directPlayable`, `decodedUrl`, `duration`
- `local-json`: `ok`, `src`, `mode`, `directPlayable`, `duration`
- `raw-bytes`: `status`, `contentType`, `acceptRanges`, `contentRange`, `streamUrl`
- `series-json`: `ok`, `src`, `mode`, `sourceType`, `streamUrl`
- `live-hls`: `ok`, `src`, `mode`, `streamUrl`, `contentType`
- `error-json`: `ok`, `error`, `reason`

The route response body shadow does not claim to be an active implementation.
It records the stable response shape contract that a later inactive route may
use when it becomes safe to approach active runtime integration.

## Error Taxonomy

Invalid fixtures must use these error codes:

- `MISSING_ROUTE`
- `UNKNOWN_ROUTE`
- `MISSING_STREAM_URL`
- `UNSAFE_STREAM_URL`
- `UNSUPPORTED_CLIENT_TYPE`
- `UNSUPPORTED_SOURCE_TYPE`
- `UNSUPPORTED_PLAYBACK_MODE`

## Safety Boundary

The response body shadow must not:

- start the production Node server
- register HTTP routes
- import Haskell code from active runtime
- call FTP, HTTP, live, localhost, or dev-only URLs
- call FFmpeg
- modify desktop direct-play behavior
- modify mobile HLS behavior
- modify frontend playback code
- use secrets or write permissions

Fixtures may contain inert `.example.test`, `local://`, or `placeholder://`
values only. The tools parse those strings but never open them.

Freeze baseline extension: inactive route response body parity v1.

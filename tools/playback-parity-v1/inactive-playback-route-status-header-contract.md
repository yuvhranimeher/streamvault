# Inactive Playback Route Status/Header Contract V1

This contract defines a shadow-only status and header parity layer for the
inactive Haskell playback route migration. It compares expected Node/JS route
status/header decisions with a standalone Haskell shadow using local fixtures
only.

## Scope

The status/header shadow reads fixture records and emits deterministic response
metadata envelopes. It does not produce response bodies beyond the body shape
label, and it never starts a server or registers an active route.

Each output envelope contains:

- `fixtureId`
- `decision`
- `status`
- `headers`
- `bodyShape`
- `reasonCode`
- `safetyNotes`

Headers are deterministic:

- keys are lowercase
- keys are sorted in the emitted object
- no dates are emitted
- no random, host, process, or request-id values are emitted
- `cache-control` is explicit on every decision
- `content-type` is explicit on every decision

## Accepted Decisions

Successful inactive route fixtures return `decision: accepted`.

Invalid or denied inactive route fixtures return `decision: rejected` with a
stable `reasonCode`. The status taxonomy is:

- `OK`: `200`
- `PARTIAL_CONTENT`: `206`
- `MISSING_ROUTE`: `404`
- `UNKNOWN_ROUTE`: `404`
- `UNSUPPORTED_METHOD`: `405`
- `MISSING_ID`: `400`
- `MALFORMED_ID`: `400`
- `MISSING_STREAM_URL`: `400`
- `UNSAFE_STREAM_URL`: `400`
- `ADAPTER_DENIED`: `403`
- `UNSUPPORTED_SOURCE_TYPE`: `422`
- `UNSUPPORTED_CLIENT_TYPE`: `422`
- `UNSUPPORTED_PLAYBACK_MODE`: `422`
- `UNSUPPORTED_BODY_SHAPE`: `422`
- `RESPONSE_BODY_DENIED`: `502`

## Header Shapes

JSON route shapes use:

- `cache-control: no-store`
- `content-type: application/json; charset=utf-8`
- `x-streamvault-shadow: inactive-route-status-header-v1`

Live HLS metadata uses:

- `cache-control: no-store`
- `content-type: application/vnd.apple.mpegurl`
- `x-streamvault-shadow: inactive-route-status-header-v1`

Raw byte metadata uses:

- `accept-ranges: bytes`
- `cache-control: no-store`
- `content-type: video/mp4`
- `x-streamvault-shadow: inactive-route-status-header-v1`

Range raw byte metadata additionally includes deterministic `content-range`
using the fixture range string followed by `/*`.

Unsupported method errors additionally include:

- `allow: GET, POST`

## Safety Boundary

This contract is read-only and fixture-only:

- no server startup
- no network calls
- no FTP/live URL calls
- no FFmpeg calls
- no active HTTP route registration
- no Haskell import from active runtime
- no production frontend integration
- no desktop direct-play behavior change
- no mobile HLS behavior change

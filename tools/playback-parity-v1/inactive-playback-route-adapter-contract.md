# Inactive Playback Route Adapter Contract

This contract defines the shadow-only request/response adapter used by the
StreamVault Haskell playback migration. The adapter models how an HTTP playback
request would be normalized before reaching the inactive route decision planner,
but it is not registered with any server and is not part of production playback.

## Responsibilities

The inactive adapter must:

- parse local route request fixtures
- normalize the route target from fixture request method and path
- normalize query-style and body-style request inputs into the route contract shape
- validate `sourceType`, `clientType`, and `streamUrl`
- call the inactive route decision planner behavior
- return a response envelope JSON object for each fixture

The response envelope remains aligned with inactive playback route response
envelope v1:

- `ok`
- `route`
- `sourceType`
- `clientType`
- `playbackMode`
- `streamUrl`
- `requiresTranscode`
- `shouldUseFfmpeg`
- `statusCode`
- `errorCode`
- `reason`
- `safety`

Adapter outputs may also include trace fields such as `caseName`,
`requestMethod`, `requestPath`, `routeTarget`, `responseKind`,
`expectedInputFields`, and `expectedOutputFields` so reviewers can verify the
normalization path.

## Normalization Rules

The adapter reads fixture requests shaped like:

```json
{
  "request": {
    "method": "GET",
    "path": "/api/playback/movie",
    "query": {},
    "body": {}
  }
}
```

For `GET` requests, query values are preferred and body values are fallback
only. For `POST` requests, body values are preferred and query values are
fallback only.

The adapter normalizes:

- `streamUrl` from `streamUrl`, `url`, or `src`
- `clientType` from `clientType`, or from a boolean `mobile` hint when present
- `sourceType` from `sourceType`
- `playbackMode` from `playbackMode`, `mode`, `forceHls`, or live `.m3u8`
  defaults
- `requiresTranscode` and `shouldUseFfmpeg` from fixture hints, defaulting to
  mobile HLS behavior when omitted

The adapter normalizes request paths to frozen route targets:

- `/api/playback/movie`
- `/api/playback/local`
- `/api/playback/ftp`
- `/api/ftp/raw`
- `series episode playback`
- `live TV m3u8 playback`

## Validation Rules

The adapter rejects:

- missing routes
- unknown routes
- unsupported methods
- missing `sourceType`
- unsupported `sourceType`
- missing `clientType`
- unsupported `clientType`
- missing `streamUrl`
- unsafe `streamUrl`
- unsupported `playbackMode`

Only `http://`, `https://`, `ftp://`, and `local://` fixture URLs are accepted.
Fixtures must use local-only placeholder hosts such as `*.example.test` or
`local://` paths. The adapter never opens those URLs.

## Boundaries

The inactive adapter must not:

- start a server
- call the network
- call FFmpeg
- register an active HTTP route
- wire Haskell route code into any active server
- integrate with frontend playback code
- modify production runtime playback behavior
- use secrets
- require write permissions

The adapter is read-only shadow tooling. It exists only under
`tools/playback-parity-v1/` and may be run by local gates or CI review scripts.

Freeze baseline extension: inactive route adapter tests v1.

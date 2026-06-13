# Inactive Playback Route Response Envelope

This contract defines the normalized response envelope for inactive playback
route decisions. It is shadow-only and is not wired into runtime playback, the
production Node server, or any active HTTP route.

## Envelope Fields

Every inactive playback route decision must include:

- `ok`: boolean success flag.
- `route`: normalized route target string.
- `sourceType`: normalized fixture source type.
- `clientType`: normalized fixture client type.
- `playbackMode`: normalized route playback mode.
- `streamUrl`: fixture stream URL, or an empty string for missing input.
- `requiresTranscode`: boolean transcode expectation.
- `shouldUseFfmpeg`: boolean FFmpeg expectation.
- `statusCode`: integer status code for the inactive decision.
- `errorCode`: string error code for invalid decisions, empty string for valid decisions.
- `reason`: human-readable decision reason.
- `safety`: object documenting read-only safety:
  - `serverStarted`
  - `networkCalled`
  - `ffmpegStarted`
  - `runtimePlaybackChanged`
  - `activeRoutesAdded`
  - `inactiveRouteWired`

Existing comparator fields such as `caseName`, `routeTarget`,
`futureHaskellMirrorName`, `riskLevel`, `responseKind`,
`routeMayStreamBytes`, `routeReturnsJson`, `expectedInputFields`, and
`expectedOutputFields` may remain present for backward-compatible shadow
comparison.

## Valid Decisions

Valid fixtures must produce:

- `ok: true`
- `statusCode: 200`
- `errorCode: ""`
- non-empty `reason`
- safety flags all set to false

## Invalid Decisions

Invalid fixtures must produce:

- `ok: false`
- non-200 `statusCode`
- non-empty `errorCode`
- non-empty `reason`
- safety flags all set to false

## Error Taxonomy

- `MISSING_ROUTE`
- `UNKNOWN_ROUTE`
- `MISSING_STREAM_URL`
- `UNSAFE_STREAM_URL`
- `UNSUPPORTED_CLIENT_TYPE`
- `UNSUPPORTED_SOURCE_TYPE`
- `UNSUPPORTED_PLAYBACK_MODE`
- `INVALID_FIXTURE`

## Safety Boundary

The envelope is produced only by read-only shadow tools under
`tools/playback-parity-v1/`. The tools must not:

- start the production Node server
- add or register active HTTP routes
- wire Haskell route code into an active server
- modify active Node playback runtime
- modify production frontend playback code
- call FTP or live URLs
- call FFmpeg
- use secrets
- add write permissions

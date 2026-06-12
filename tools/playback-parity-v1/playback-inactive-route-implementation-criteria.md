# Inactive Playback Route Implementation Criteria

This document defines the criteria for the first inactive Haskell playback route
implementation branch after the playback shadow freeze baseline.

## Required Boundary

- Route code may be added only behind disabled shadow mode.
- Haskell playback route code must receive no production traffic.
- There must be no default enablement.
- There must be no frontend playback changes.
- There must be no active HTTP route registration.
- Tests must not start the production Node server.
- Tests must not call FTP or live network URLs.
- Tests must not call FFmpeg.

## Playback Invariants

- Desktop direct play must preserve original FTP behavior.
- Mobile HLS remains allowed only when required.
- Desktop playback must not automatically transcode.
- Local playback must not be forced through HLS by default.
- Live m3u8 behavior must remain live-mode only.

## Required Gates

Before review, all existing shadow gates must pass:

```sh
npm run test:playback-shadow
npm run test:playback-shadow-review
npm run report:playback-shadow-readiness
npm run report:playback-shadow-artifacts
```

The freeze manifest gate must also pass:

```sh
npm run test:playback-shadow-freeze
```

## New Inactive Route Tests

Any new inactive Haskell route tests must:

- compare against the frozen route contract fixtures
- preserve the frozen route inventory target list unless a new freeze baseline is approved
- avoid production server startup
- avoid real FTP/live network calls
- avoid FFmpeg
- prove default-disabled behavior
- prove no frontend dependency on the inactive route

## Review Requirement

If any frozen fixture, inventory target, comparator behavior, CI safety rule, or
artifact process needs to change, create a new freeze baseline branch before
adding inactive route implementation work.

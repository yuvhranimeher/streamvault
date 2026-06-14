# Inactive Playback Route Implementation Shadow Contract

This contract defines the first composed inactive Haskell playback route
implementation shadow. It behaves like a complete route implementation envelope
over local fixtures while remaining fully unwired from active runtime playback.

The implementation shadow composes the already-proven local layers:

- adapter selection and input normalization
- response body shaping
- status/header metadata
- error taxonomy metadata
- final readiness safety contract

## Required Output Fields

Every composed route result must include:

- `fixtureId`
- `routeDecision`
- `ok`
- `status`
- `headers`
- `body`
- `errorTaxonomy`
- `adapterDecision`
- `responseBodyDecision`
- `statusHeaderDecision`
- `safetyNotes`

## Safety Rules

The implementation shadow is fixture-only and read-only. It must not:

- start `server.js`
- register active Node, Express, or Haskell HTTP routes
- import from active runtime routing files
- call FTP, live, localhost, or loopback URLs
- call FFmpeg
- change desktop direct-play behavior
- change mobile HLS behavior
- touch frontend playback code

Fixture URLs are restricted to `*.example.test`, `local://`, or explicit
unsafe placeholder fixtures used only for rejection coverage.

# Inactive Playback Route Error Taxonomy Contract

This contract defines the fixture-only, shadow-only response error taxonomy
used by the StreamVault Haskell playback migration. It compares the normalized
Node/JS route error decision with the Haskell shadow decision without starting
the server, changing runtime playback behavior, calling the network, or invoking
FFmpeg.

## Normalized Envelope

Each JS and Haskell shadow decision must emit these deterministic fields:

- `fixtureId`
- `decision`
- `ok`
- `status`
- `errorCode`
- `errorCategory`
- `reasonCode`
- `userSafeMessage`
- `developerDetail`
- `retryable`
- `headers`
- `bodyShape`
- `safetyNotes`

Header keys are lowercase and sorted. The envelope must not contain dates,
timestamps, random IDs, machine-specific paths, stack traces, secrets, or live
URLs.

## Stable Categories

- `VALIDATION_ERROR`
- `UNSAFE_URL`
- `ADAPTER_DENIED`
- `BODY_REJECTED`
- `HEADER_REJECTED`
- `METHOD_NOT_ALLOWED`
- `NOT_FOUND`
- `SHADOW_INTERNAL_ERROR`

Every error maps to a deterministic HTTP status, reason code, safe user
message, non-sensitive developer detail, retryability flag, JSON error body
shape, and shadow-only safety notes.

## Safety Boundary

This slice is limited to `tools/playback-parity-v1` and npm script wiring. It
does not import Haskell shadows from active runtime files, does not register
routes, does not touch frontend playback code, and does not activate FTP, live,
local server, or FFmpeg behavior.

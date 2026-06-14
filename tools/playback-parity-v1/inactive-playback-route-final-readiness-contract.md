# Inactive Playback Route Final Readiness Contract

This contract defines the final shadow-only readiness gate for the inactive
Haskell playback route migration.

The gate is read-only. It may inspect local fixtures, local shadow adapters,
local Haskell shadows, git diffs, and npm script wiring. It must not start the
production server, register routes, call FTP/live URLs, invoke FFmpeg, or touch
frontend playback behavior.

## Required Parity Inputs

- Adapter parity must report `Status: PASS`.
- Response body parity must report `Status: PASS`.
- Status/header parity must report `Status: PASS`.
- Error taxonomy parity must report `Status: PASS`.
- Implementation shadow parity must report `Status: PASS`.

## Required Safety Inputs

- No active runtime route wiring is added.
- No inactive route shadow is imported by `server.js`, `public/`, `routes/`,
  `middleware/`, `src/`, or `lib/`.
- No production server start command is added.
- No FTP, live, localhost, or loopback URL activation is added.
- No FFmpeg invocation is added.
- No frontend playback file changes are required.
- All final-readiness fixture URLs are restricted to `*.example.test`,
  `local://`, or explicit unsafe placeholder fixtures.

## Output

The final readiness aggregator emits a deterministic JSON summary listing the
required component gates and shadow-only safety invariants. The report generator
then executes the required gates and fails unless every required status is
`PASS`.

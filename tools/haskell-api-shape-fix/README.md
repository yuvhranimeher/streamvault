# Haskell API Shape Fix Fixture

Safe read-only StreamVault tool.

It reads captured Node API snapshots from:

- `tools/haskell-shadow-api-comparator/snapshots/node`

It writes Node-compatible Haskell fixture outputs to:

- `tools/haskell-api-shape-fix/out`
- `tools/haskell-safe-suite/out`

Why this exists:

Before a Haskell shadow server can be trusted, the exact API envelopes must be locked:

- `/api/home-feed`
- `/api/section/:key`
- `/api/movies`
- `/api/series`
- `/api/search`
- `/api/downloads`

This tool does not migrate runtime code. It creates exact contract fixtures so the next comparator run can verify that the Haskell side is targeting the same shapes as Node.

It does not edit Node server, frontend, playback, catalog, posters, service worker, or ports.

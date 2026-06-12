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
- live TV m3u8 playback
- invalid missing `streamUrl`

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
gate, workflow safety, artifact manifest validation, and readiness indexing.

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
- JS/Haskell comparator behavior
- read-only CI/review/artifact workflow
- safety invariants listed in this document
- accepted npm scripts listed above

## What Is Not Implemented Yet

- no active HTTP routes
- no inactive Haskell HTTP routes yet
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

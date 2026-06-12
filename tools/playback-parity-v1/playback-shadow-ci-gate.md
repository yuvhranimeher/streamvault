# Playback Shadow CI Gate

Run the full read-only playback shadow gate locally with:

```sh
python3 tools/playback-parity-v1/run_playback_shadow_ci.py --write-report
```

Or, when Node tooling is loaded:

```sh
npm run test:playback-shadow
```

## What It Validates

- Playback planner fixture schema.
- Haskell playback shadow planner static and compiled validation.
- JS vs Haskell playback planner parity.
- Playback route inventory schema.
- Playback route fixture schema.
- Inventory vs fixture crosscheck.
- JS vs Haskell playback route contract parity.
- The route shadow full gate wrapper.

The checks preserve the current shadow contract expectations:

- Desktop direct play preserves original FTP sources.
- Mobile HLS is allowed only when required by compatibility.
- Desktop playback must not automatically transcode.
- Byte-stream-capable route contracts are documented separately from JSON-only contracts.

## What It Does Not Do

- It does not start the production Node server.
- It does not call live media sources or the network.
- It does not start FFmpeg.
- It does not add or register HTTP routes.
- It does not modify runtime playback behavior.
- It does not touch production frontend playback code.

## Runtime Safety

The runner executes pure local schema and comparator scripts under `tools/playback-parity-v1/`.
Haskell binaries are compiled into temporary directories by the comparator gates, and the direct
validation command may write only normal local compiler artifacts if run outside those gates.
The CI runner itself writes only timestamped reports when `--write-report` is supplied.

## Path Toward A Real Haskell Route

Before adding active Haskell playback routes, keep expanding this shadow contract:

1. Add fixtures for any newly documented route behavior.
2. Update the JS and Haskell shadow comparators until they agree.
3. Keep route inventory and fixture crosschecks passing.
4. Only after parity is stable, add an inactive or separately gated Haskell implementation plan.
5. Add active runtime routing in a later branch with explicit review of desktop direct FTP,
   mobile HLS compatibility, and no automatic desktop transcoding.

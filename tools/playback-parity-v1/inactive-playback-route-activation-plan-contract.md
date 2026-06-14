# Inactive Playback Route Activation Plan Contract

This contract defines a controlled planning layer for a future inactive
Haskell playback route activation. It is not activation, not runtime wiring,
and not a frontend playback change.

The plan is documentation and local validation only. It may inspect local
shadow reports, local contracts, npm script wiring, and git diffs. It must not
start the production server, register active routes, call FTP or live URLs,
invoke FFmpeg, or change playback behavior.

## Future Activation Files

A later activation PR may touch only these runtime files unless this contract is
updated first:

- `server.js`
- `routes/inactive-playback-route-haskell.js`
- `routes/inactive-playback-route-flags.js`

Those files must not be touched in this planning PR.

## Files Not Touched Yet

This planning PR must not change:

- `server.js`
- `public/app.js`
- `public/details.js`
- `public/player.js`
- `public/livetv.js`
- `public/movies-page-fix.js`
- `public/series-page-fix.js`
- `routes/**`
- `middleware/**`
- `lib/**`
- `src/**`

## Feature Flag Strategy

The future activation must be guarded by
`STREAMVAULT_INACTIVE_HASKELL_PLAYBACK_ROUTE`. Its default value is `off`, and
unset or unknown values must fail closed to the existing Node playback behavior.
The planned values are:

- `off`: existing Node behavior only.
- `shadow`: run comparison without changing responses.
- `canary`: allow limited server-side traffic after smoke tests pass.
- `on`: full activation after explicit approval.

## Preservation Guarantees

- Desktop FTP direct-play must preserve the original FTP/proxy/raw source path.
- Mobile HLS must remain selected only when required.
- Desktop direct playback must not invoke FFmpeg automatically.
- Live URLs must not be activated by planning gates.
- Emergency disable is unsetting or setting the feature flag to `off` and
  redeploying/restarting the existing service path.

## Required Gates

Before any activation PR, these commands must pass:

- `npm run test:playback-shadow`
- `npm run test:playback-shadow-review`
- `npm run test:playback-inactive-route-final-readiness`
- `npm run test:playback-inactive-route-implementation-shadow`
- `npm run test:playback-inactive-route-activation-plan`

After activation, smoke tests must prove desktop direct-play preservation,
mobile HLS preservation, no desktop FFmpeg activation, feature-flag rollback,
range-header preservation, and existing Node behavior when the flag is off.

# Inactive Playback Route Activation Checklist

This checklist is for a future activation PR. It is not permission to wire the
route in this branch.

## Before Activation

- Confirm `STREAMVAULT_INACTIVE_HASKELL_PLAYBACK_ROUTE` defaults to `off`.
- Confirm `npm run test:playback-shadow` passes.
- Confirm `npm run test:playback-shadow-review` passes.
- Confirm `npm run test:playback-inactive-route-final-readiness` passes.
- Confirm `npm run test:playback-inactive-route-implementation-shadow` passes.
- Confirm `npm run test:playback-inactive-route-activation-plan` passes.
- Confirm the active runtime diff is limited to the exact future activation
  files listed in the boundary manifest.
- Confirm no frontend playback files are changed for the first server-side
  activation.
- Confirm no new dependency, package version, tunnel, Cloudflare, FTP, live, or
  FFmpeg configuration is introduced.

## Activation Shape

- Add route code behind the feature flag only.
- Keep the flag `off` by default in every environment.
- In `shadow`, compare the Haskell route envelope without changing responses.
- In `canary`, allow only explicitly selected server-side requests.
- In `on`, allow broader route use only after canary smoke tests pass.

## Required Preservation Checks

- Desktop FTP direct-play preserves proxy/raw/direct behavior.
- Desktop direct playback does not start FFmpeg automatically.
- Mobile HLS remains selected only when required.
- Local playback still returns the existing source behavior.
- Movie metadata playback still returns the existing envelope.
- Raw FTP byte range still returns `206` and range headers.
- Live playback remains unchanged unless a separate live-specific activation is
  approved.

## Emergency Disable

- Set `STREAMVAULT_INACTIVE_HASKELL_PLAYBACK_ROUTE=off` or remove the variable.
- Restart or redeploy the existing Node service path.
- Re-run the flag-off smoke tests.
- Revert the activation PR if flag-off behavior does not immediately match the
  pre-activation baseline.

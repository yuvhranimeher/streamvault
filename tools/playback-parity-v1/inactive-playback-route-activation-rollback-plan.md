# Inactive Playback Route Activation Rollback Plan

This rollback plan applies to a future activation PR. This branch does not
activate or wire the route.

## Primary Rollback

1. Set `STREAMVAULT_INACTIVE_HASKELL_PLAYBACK_ROUTE=off`, or remove the
   environment variable.
2. Restart or redeploy the existing Node service path.
3. Verify existing Node playback handles all requests.
4. Run the flag-off smoke tests for desktop direct play, mobile HLS, local
   playback, movie metadata playback, raw byte range playback, and live playback
   unchanged behavior.

## Secondary Rollback

1. Revert the future activation PR.
2. Confirm the revert does not touch fixture, readiness, or activation-planning
   reports except for the active runtime files from that activation PR.
3. Re-run the pre-activation gate set.

## Emergency Disable Path

The emergency disable path is intentionally simple: flag off, restart, and
verify. Unknown flag values must behave as `off`. If flag-off behavior does not
immediately match the pre-activation baseline, revert the activation PR.

## Rollback Success Criteria

- Desktop direct-play keeps the original FTP/proxy/raw source path.
- Mobile HLS behavior is unchanged.
- Desktop direct playback does not automatically start FFmpeg.
- No live URL behavior changes.
- Existing Node playback responses are restored.

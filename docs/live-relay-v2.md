# Live relay v2

Live relay v2 is an additive, opt-in HLS relay. The existing `/live/` and
`/live-relay/` routes remain the production defaults and are not changed by
this module.

## Safety model

- V2 is disabled unless `SV_LIVE_RELAY_V2_ENABLED=1`.
- V2 accepts channel IDs from `channels.json`; it never accepts an arbitrary
  source URL from a request.
- Each channel has at most one FFmpeg worker.
- FFmpeg uses `-c copy`; v2 does not transcode.
- HLS segments are stored in a stable per-channel directory so the last good
  window remains available while an upstream worker reconnects.
- Per-channel and global disk limits, worker limits, and client limits are
  enforced.
- Slow clients read independent files through Express and cannot block the
  single upstream pull.
- If v2 cannot provide a playlist, it redirects to the existing v1 relay by
  default.
- Status routes use the same access guard as the existing infrastructure
  telemetry routes.

## Canary configuration

Keep the frontend on v1. Enable v2 only on the backend and test its versioned
URL directly:

```text
SV_LIVE_RELAY_V2_ENABLED=1
SV_LIVE_RELAY_V2_PREWARM_CHANNELS=tsports
```

The canary playlist is:

```text
/live-relay-v2/tsports/playlist.m3u8
```

Operational status is available at:

```text
/api/live-relay-v2/status
/api/live-relay-v2/status/tsports
```

Do not put a channel in `SV_LIVE_RELAY_V2_PREWARM_CHANNELS` unless it is
configured and authorized for distribution.

## Defaults

| Setting | Default | Purpose |
| --- | ---: | --- |
| `SV_LIVE_RELAY_V2_PLAYLIST_SEGMENTS` | 18 | Rolling playlist window |
| `SV_LIVE_RELAY_V2_SEGMENT_SECONDS` | 2 | Requested HLS segment duration |
| `SV_LIVE_RELAY_V2_MAX_SEGMENTS` | 40 | Per-channel disk segment limit |
| `SV_LIVE_RELAY_V2_MAX_BYTES` | 256 MiB | Per-channel disk byte limit |
| `SV_LIVE_RELAY_V2_MAX_TOTAL_BYTES` | 1 GiB | Global v2 disk byte limit |
| `SV_LIVE_RELAY_V2_MAX_WORKERS` | 12 | Concurrent v2 FFmpeg workers |
| `SV_LIVE_RELAY_V2_MAX_CHANNEL_CLIENTS` | 150 | Segment responses per channel |
| `SV_LIVE_RELAY_V2_MAX_TOTAL_CLIENTS` | 500 | Total v2 segment responses |
| `SV_LIVE_RELAY_V2_STALE_SERVE_MS` | 90000 | Last-good playlist recovery window |
| `SV_LIVE_RELAY_V2_FALLBACK_TO_V1` | 1 | Redirect unavailable v2 playlists to v1 |

The segment duration is a target. With stream copy, actual boundaries follow
upstream keyframes and can be longer or shorter.

## Validation

Run the focused unit and boundary suite:

```text
npm run test:live-relay-v2
```

Run the generated-content 30-minute soak with simultaneous viewers and a
controlled upstream interruption:

```text
npm run test:live-relay-v2:soak -- --duration-seconds 1800 --clients 12
```

The soak uses only a locally generated synthetic stream. It reports startup
and recovery latency, playlist/segment success, FFmpeg process count, CPU,
RAM, cache size, upstream bytes, downstream bytes, and the
Live TV -> movie -> series -> Live TV route sequence.

## Rollback

Set `SV_LIVE_RELAY_V2_ENABLED=0` (or remove it) and restart the backend. The
frontend continues to use `/live-relay/`, so no frontend rollback or route
change is required. After v2 workers stop, `cache/live-relay-v2/` may be
deleted. Do not modify or delete `cache/live-relay/` as part of this rollback.

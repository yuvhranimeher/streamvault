# Inactive Playback Route Fixture Coverage PR Summary

Status: PASS

## Branch Context

- Base branch: `haskell-playback-inactive-route-fixture-coverage-20260613-003827`
- Current branch: `haskell-playback-fixture-coverage-review-pack-20260613-095409`
- HEAD: `74879be`

## Fixture Coverage

- Fixture count: 16
- Invalid fixtures: ['route_invalid_missing_streamUrl', 'route_invalid_unknown_route', 'route_invalid_unsupported_clientType', 'route_invalid_unsupported_sourceType', 'route_invalid_unsafe_non_http_streamUrl', 'route_invalid_missing_routeTarget', 'route_invalid_missing_sourceType', 'route_invalid_missing_clientType']

## New Coverage Cases

- desktop movie direct: present fixtures=['route_desktop_movie_direct_json']
- mobile movie HLS: present fixtures=['route_mobile_movie_hls_planning']
- desktop series episode direct: present fixtures=['route_series_episode_planning']
- mobile series episode HLS: present fixtures=['route_mobile_series_episode_hls_planning']
- FTP raw stream metadata: present fixtures=['route_ftp_raw_stream_metadata']
- local file playback metadata: present fixtures=['route_local_playback_metadata']
- live TV HLS contract: present fixtures=['route_live_tv_hls_contract']
- invalid missing streamUrl: present fixtures=['route_invalid_missing_streamUrl']
- invalid unknown route: present fixtures=['route_invalid_unknown_route']
- invalid unsupported clientType: present fixtures=['route_invalid_unsupported_clientType']
- invalid unsupported sourceType: present fixtures=['route_invalid_unsupported_sourceType']
- invalid unsafe/non-http streamUrl: present fixtures=['route_invalid_unsafe_non_http_streamUrl']
- invalid missing route target: present fixtures=['route_invalid_missing_routeTarget']
- invalid missing sourceType: present fixtures=['route_invalid_missing_sourceType']
- invalid missing clientType: present fixtures=['route_invalid_missing_clientType']

## Route Targets Covered

- `/api/playback/local`
- `/api/playback/ftp`
- `/api/playback/movie`
- `/api/ftp/raw`
- `live TV m3u8 playback`
- `series episode playback`

## Gate Status

- Fixture coverage audit status: PASS
- JS/Haskell route comparator status: PASS
- Inactive route gate status: PASS
- Inactive safety status: PASS
- CI gate status: PASS
- Freeze manifest status: PASS
- Review pack status: PASS
- Workflow safety status: PASS

## Latest Reports

- fixture_coverage_audit: `tools/playback-parity-v1/inactive-playback-route-fixture-coverage-report-20260613-095046.txt`
- inactive_route_gate: `tools/playback-parity-v1/inactive-playback-route-v1-gate-report-20260613-095023.txt`
- inactive_route_safety: `tools/playback-parity-v1/inactive-playback-route-v1-safety-report-20260613-095024.txt`
- route_comparator: `tools/playback-parity-v1/playback-route-contract-js-vs-hs-report-20260612-182035.txt`
- freeze_manifest: `tools/playback-parity-v1/playback-shadow-freeze-manifest-report-20260613-095024.txt`
- ci_gate: `tools/playback-parity-v1/playback-shadow-ci-report-20260613-095046.txt`
- review_pack: `tools/playback-parity-v1/playback-shadow-review-pack-report-20260613-095046.txt`
- workflow_safety: `tools/playback-parity-v1/playback-shadow-workflow-safety-report-20260613-095046.txt`

## Runtime Wiring Statement

server_started: no
network_called: no
ffmpeg_started: no
runtime_playback_changed: no
active_routes_added: no
inactive_route_wired: no

This summary is read-only reviewer documentation for frozen fixture coverage.
It does not register active HTTP routes, does not wire the inactive Haskell route into the Node server, and does not modify production frontend playback code.

## Reviewer Checklist

- [ ] Fixture coverage cases are present.
- [ ] Invalid cases are present.
- [ ] Fixtures use fake/local placeholder URLs only.
- [ ] No active route wiring was added.
- [ ] Production frontend playback code did not change.
- [ ] Package dependency and version fields did not change.
- [ ] No server startup was added.
- [ ] No FTP/live URL calls were added.
- [ ] No FFmpeg calls were added.
- [ ] All fixture coverage gates pass.

## Remaining Blockers

- None.

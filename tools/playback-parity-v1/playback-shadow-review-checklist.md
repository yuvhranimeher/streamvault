# Playback Shadow Review Checklist

- [ ] Branch was created from the latest Haskell shadow branch, not `master`.
- [ ] `master` was not modified.
- [ ] No production runtime behavior changed.
- [ ] No active HTTP route was added.
- [ ] Production frontend playback code was not touched.
- [ ] Package versions and dependencies were not changed.
- [ ] No production Node server was started by the tooling.
- [ ] No FTP or live URL was called by the tooling.
- [ ] FFmpeg was not called by the tooling.
- [ ] Desktop direct play preserves original FTP source expectations.
- [ ] Mobile HLS remains allowed only when required.
- [ ] Desktop playback does not automatically transcode.
- [ ] Playback shadow CI runner passes.
- [ ] GitHub Actions workflow safety audit passes.
- [ ] JS/Haskell playback planner comparator passes.
- [ ] Route contract JS/Haskell comparator passes.
- [ ] Review-pack summary has no remaining blockers.

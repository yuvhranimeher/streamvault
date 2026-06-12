# Playback Shadow Artifact Inspection

This guide is for reviewing the read-only `playback-shadow-review-pack` artifact
created by the Playback Shadow CI workflow.

## Open The GitHub Actions Run

1. Open the pull request for the playback shadow branch.
2. Open the Checks tab or the Actions link for `Playback Shadow CI`.
3. Select the latest workflow run for the pull request.
4. Confirm the job name is `Read-only playback shadow gates`.

The workflow is expected to run only on `pull_request` and `workflow_dispatch`
with `contents: read` permission.

## Find The Artifact

1. In the workflow run page, scroll to Artifacts.
2. Download `playback-shadow-review-pack`.
3. Extract the artifact locally.
4. Open `manifest.txt` first.

## Files In The Artifact

The artifact should contain:

- `manifest.txt`
- latest playback shadow CI report
- latest playback shadow PR summary
- latest playback shadow review-pack report
- latest workflow safety report
- latest JS/Haskell playback planner compare report
- latest route contract JS/Haskell compare report

## Read The CI Report

Open the `playback-shadow-ci-report-*.txt` file and confirm:

- `Status: PASS`
- `server_started: no`
- `network_called: no`
- `ffmpeg_started: no`
- `runtime_playback_changed: no`
- `failed_gates: []`
- all eight gate summary lines show `Status: PASS`

## Read The PR Summary

Open the `playback-shadow-pr-summary-*.md` file and confirm:

- branch context matches the reviewed branch
- CI gate status is PASS
- JS vs Haskell planner status is PASS
- route contract comparator status is PASS
- workflow safety status is PASS
- remaining blockers are `None`

## Read The Workflow Safety Report

Open the `playback-shadow-workflow-safety-report-*.txt` file and confirm:

- `Status: PASS`
- triggers are `pull_request` and `workflow_dispatch`
- required permission is `contents: read`
- upload artifact and step summary are allowed
- PR comments are avoided
- `forbidden_hits: {}`

## Verify No Runtime Playback Changes

Review the branch diff and confirm:

- no production frontend playback file was modified
- no active HTTP routes were added
- no production Node server startup was added
- no package versions or dependencies changed
- no secrets or write permissions were introduced

The shadow contract remains:

- desktop direct play preserves original FTP behavior
- mobile HLS is used only when required
- desktop playback does not automatically transcode

## Reviewer Checklist

- [ ] Artifact `playback-shadow-review-pack` is present.
- [ ] `manifest.txt` lists all expected reports.
- [ ] CI report is PASS.
- [ ] PR summary is PASS and has no blockers.
- [ ] Workflow safety report is PASS with no forbidden hits.
- [ ] JS/Haskell planner comparator is PASS.
- [ ] Route contract comparator is PASS.
- [ ] No runtime playback code changed.
- [ ] No PR comment posting or write permission was added.

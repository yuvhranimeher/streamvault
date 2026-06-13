# Playback Parity V1

This directory contains the read-only playback shadow gates used during the
StreamVault Haskell migration. The tools here validate contracts, fixtures,
reports, and review artifacts without changing production playback behavior.

## Local Commands

Run the main shadow CI gate:

```sh
npm run test:playback-shadow
```

Run the reviewer pack:

```sh
npm run test:playback-shadow-review
```

Collect the latest review artifact bundle:

```sh
npm run collect:playback-shadow-artifacts
```

Validate the collected artifact bundle:

```sh
npm run report:playback-shadow-artifacts
```

Run the inactive route fixture coverage audit:

```sh
npm run test:playback-inactive-route-fixtures
```

Run the inactive route response envelope gate:

```sh
python3 tools/playback-parity-v1/inactive_playback_route_response_envelope_gate.py --write-report
```

Run the inactive route adapter tests:

```sh
npm run test:playback-inactive-route-adapter
```

Run the inactive route response body parity tests:

```sh
npm run test:playback-inactive-route-response-body
```

Run the inactive route status/header parity tests:

```sh
npm run test:playback-inactive-route-status-headers
```

Run the inactive route error taxonomy parity tests:

```sh
npm run test:playback-inactive-route-error-taxonomy
```

## Main Entry Points

- `run_playback_shadow_ci.py` runs all read-only playback shadow gates.
- `run_playback_shadow_review_pack.py` runs CI, workflow safety, and PR summary generation.
- `collect_playback_shadow_artifacts.py` copies the latest review reports into `.playback-shadow-artifacts/`.
- `playback-shadow-artifact-inspection.md` explains how reviewers inspect the GitHub Actions artifact.
- `playback-shadow-review-checklist.md` gives reviewers a safety checklist.

## Route Contract Gates

- `playback_route_inventory_schema_gate.py` validates the route inventory schema.
- `playback_route_fixture_schema_gate.py` validates route contract fixtures.
- `inactive_playback_route_response_envelope_gate.py` validates the inactive route response envelope and error taxonomy.
- `inactive_playback_route_fixture_coverage_audit.py` verifies inactive route fixture coverage v1.
- `inactive_playback_route_adapter_js_vs_hs_compare.py` compares JS and Haskell inactive adapter envelopes.
- `inactive_playback_route_adapter_safety_gate.py` verifies inactive adapter tests remain shadow-only.
- `inactive_playback_route_response_body_js_vs_hs_compare.py` compares JS and Haskell route response body envelopes.
- `inactive_playback_route_response_body_envelope_gate.py` validates response payload shapes and safety fields.
- `inactive_playback_route_response_body_fixture_coverage_audit.py` verifies route response body fixture coverage.
- `inactive_playback_route_response_body_safety_gate.py` proves response body parity remains shadow-only.
- `inactive_playback_route_status_header_js_vs_hs_compare.py` compares JS and Haskell route status/header envelopes.
- `inactive_playback_route_status_header_envelope_gate.py` validates deterministic status/header fields.
- `inactive_playback_route_status_header_fixture_coverage_audit.py` verifies route status/header fixture coverage.
- `inactive_playback_route_status_header_safety_gate.py` proves status/header parity remains shadow-only.
- `inactive_playback_route_error_taxonomy_js_vs_hs_compare.py` compares JS and Haskell route error taxonomy envelopes.
- `inactive_playback_route_error_taxonomy_envelope_gate.py` validates deterministic error envelope fields.
- `inactive_playback_route_error_taxonomy_fixture_coverage_audit.py` verifies route error taxonomy fixture coverage.
- `inactive_playback_route_error_taxonomy_safety_gate.py` proves error taxonomy parity remains shadow-only.
- `playback_route_contract_crosscheck.py` checks inventory and fixtures against each other.
- `playback_route_shadow_full_gate.py` runs the route schema, crosscheck, and comparator gates together.

## JS/Haskell Comparators

- `playback_js_vs_hs_shadow_compare.py` compares JS and Haskell playback planner shadow output.
- `playback_route_contract_js_vs_hs_compare.py` compares JS and Haskell route contract shadow output.

## Workflow And Artifact Safety

- `playback_shadow_workflow_safety_audit.py` validates the GitHub Actions workflow remains read-only.
- `playback_shadow_artifact_manifest.py` validates the collected artifact bundle.
- `.playback-shadow-artifacts/manifest.txt` lists the reports included in the latest local artifact bundle.

## Safety Boundary

These tools do not:

- start the production Node server
- invoke FFmpeg
- call FTP or live URLs
- modify runtime playback behavior
- register active HTTP routes
- touch production frontend playback code
- require secrets or write permissions
- post PR comments

Freeze baseline extension: inactive route fixture coverage v1 and inactive route
response envelope v1 remain shadow-only and fixture-only. Freeze baseline
extension: inactive route adapter tests v1 remains shadow-only and fixture-only.
Freeze baseline extension: inactive route response body parity v1 remains
shadow-only and fixture-only. Freeze baseline extension: inactive route
status/header parity v1 remains shadow-only and fixture-only.
Freeze baseline extension: inactive route error taxonomy parity v1 remains
shadow-only and fixture-only.

The preserved playback contract remains:

- desktop direct playback preserves original FTP behavior
- mobile HLS is allowed only when required
- desktop playback does not automatically transcode

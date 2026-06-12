#!/usr/bin/env python3
"""Validate the read-only playback shadow freeze manifest."""

from __future__ import annotations

import json
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
TOOL_DIR = ROOT / "tools" / "playback-parity-v1"
MANIFEST_PATH = TOOL_DIR / "playback-shadow-freeze-manifest.json"
PACKAGE_PATH = ROOT / "package.json"
INVENTORY_PATH = TOOL_DIR / "playback-route-shadow-contract-inventory.json"
FIXTURE_SCHEMA_GATE = TOOL_DIR / "playback_route_fixture_schema_gate.py"

REQUIRED_SAFETY_INVARIANTS = {
    "no active HTTP routes",
    "no inactive Haskell HTTP routes yet",
    "no production server start",
    "no FFmpeg",
    "no FTP/live URL calls",
    "no runtime playback changes",
    "no frontend playback changes",
    "no secrets",
    "no write permissions",
    "no PR comment posting",
    "desktop direct-play original FTP preserved",
    "mobile HLS only when required",
    "no automatic desktop transcoding",
}


def report_path() -> Path:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    return TOOL_DIR / f"playback-shadow-freeze-manifest-report-{stamp}.txt"


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def rel_exists(path_text: str) -> bool:
    return (ROOT / path_text).exists()


def run_gate(path: Path) -> tuple[int, str, str]:
    result = subprocess.run(
        [sys.executable, str(path)],
        cwd=ROOT,
        check=False,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    return result.returncode, result.stdout, result.stderr


def main() -> int:
    write_report = "--write-report" in sys.argv
    failures: list[str] = []
    manifest = load_json(MANIFEST_PATH)
    package = load_json(PACKAGE_PATH)
    inventory = load_json(INVENTORY_PATH)

    if not isinstance(manifest, dict):
        raise SystemExit("Freeze manifest must contain a JSON object")

    checked_files: list[str] = []
    file_fields = [
        "frozenFixtureFiles",
        "frozenHaskellPlannerFiles",
        "frozenJsPlannerFiles",
        "frozenComparatorScripts",
        "frozenCiReviewScripts",
    ]
    for field in file_fields:
        values = manifest.get(field)
        if not isinstance(values, list) or not values:
            failures.append(f"{field} must be a non-empty array")
            continue
        for value in values:
            if not isinstance(value, str) or not rel_exists(value):
                failures.append(f"missing manifest file in {field}: {value}")
            else:
                checked_files.append(value)

    for field in ["frozenInventoryFile", "frozenWorkflowFile"]:
        value = manifest.get(field)
        if not isinstance(value, str) or not rel_exists(value):
            failures.append(f"missing manifest file {field}: {value}")
        else:
            checked_files.append(value)

    scripts = package.get("scripts", {}) if isinstance(package, dict) else {}
    frozen_scripts = manifest.get("frozenNpmScripts")
    if not isinstance(frozen_scripts, list) or not frozen_scripts:
        failures.append("frozenNpmScripts must be a non-empty array")
        frozen_scripts = []
    for script in frozen_scripts:
        if script not in scripts:
            failures.append(f"missing npm script: {script}")

    workflow_file = manifest.get("frozenWorkflowFile")
    workflow_text = (ROOT / workflow_file).read_text(encoding="utf-8") if isinstance(workflow_file, str) and rel_exists(workflow_file) else ""
    workflow_checks = {
        "pull_request trigger": "pull_request:" in workflow_text,
        "workflow_dispatch trigger": "workflow_dispatch:" in workflow_text,
        "contents read permission": "contents: read" in workflow_text,
        "no contents write": "contents: write" not in workflow_text,
        "no pull requests write": "pull-requests: write" not in workflow_text,
        "no secrets": "secrets." not in workflow_text,
        "no PR comments": "gh pr comment" not in workflow_text.lower()
        and "gh issue comment" not in workflow_text.lower()
        and "/issues/" not in workflow_text,
        "no npm start": "npm start" not in workflow_text and "npm run start" not in workflow_text,
        "no node server": "node server.js" not in workflow_text,
    }
    for label, passed in workflow_checks.items():
        if not passed:
            failures.append(f"workflow safety check failed: {label}")

    inventory_targets = [
        contract.get("target")
        for contract in inventory.get("contracts", [])
        if isinstance(contract, dict)
    ]
    accepted_targets = manifest.get("acceptedRouteTargets")
    if accepted_targets != inventory_targets:
        failures.append(f"acceptedRouteTargets do not match inventory targets: {accepted_targets} != {inventory_targets}")

    fixture_exit, fixture_stdout, fixture_stderr = run_gate(FIXTURE_SCHEMA_GATE)
    if fixture_exit != 0:
        failures.append("route fixture schema gate failed")

    for required in [
        "tools/playback-parity-v1/run_playback_shadow_ci.py",
        "tools/playback-parity-v1/run_playback_shadow_review_pack.py",
        "tools/playback-parity-v1/playback_shadow_readiness_index.py",
    ]:
        if not rel_exists(required):
            failures.append(f"missing required freeze support script: {required}")

    forbidden_runtime = manifest.get("forbiddenRuntimeFilesRequiredByFreeze")
    if forbidden_runtime != []:
        failures.append("forbiddenRuntimeFilesRequiredByFreeze must be an empty array")

    invariants = set(manifest.get("acceptedSafetyInvariants", []))
    missing_invariants = sorted(REQUIRED_SAFETY_INVARIANTS - invariants)
    if missing_invariants:
        failures.append(f"missing safety invariants: {missing_invariants}")

    if manifest.get("nextAllowedBranchType") != "inactive Haskell playback route implementation":
        failures.append("nextAllowedBranchType must be inactive Haskell playback route implementation")

    ok = not failures
    lines = [
        f"Status: {'PASS' if ok else 'FAIL'}",
        "mode: read-only playback shadow freeze manifest gate",
        "server_started: no",
        "network_called: no",
        "ffmpeg_started: no",
        "runtime_playback_changed: no",
        "active_routes_added: no",
        f"manifest_path: {MANIFEST_PATH.relative_to(ROOT)}",
        f"base_branch: {manifest.get('baseBranch')}",
        f"checked_file_count: {len(checked_files)}",
        f"checked_files: {checked_files}",
        f"frozen_npm_scripts: {frozen_scripts}",
        f"workflow_checks: {workflow_checks}",
        f"accepted_route_targets: {accepted_targets}",
        f"inventory_route_targets: {inventory_targets}",
        f"route_fixture_schema_exit_code: {fixture_exit}",
        "route_fixture_schema_stdout:",
        fixture_stdout.rstrip() or "(empty)",
        "route_fixture_schema_stderr:",
        fixture_stderr.rstrip() or "(empty)",
        f"missing_safety_invariants: {missing_invariants}",
        f"failures: {failures}",
    ]
    output = "\n".join(lines) + "\n"
    if write_report:
        path = report_path()
        path.write_text(output, encoding="utf-8")
        sys.stdout.write(f"report_path: {path.relative_to(ROOT)}\n")
    sys.stdout.write(output)
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())

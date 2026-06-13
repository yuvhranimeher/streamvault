#!/usr/bin/env python3
"""Generate a read-only playback shadow migration readiness index."""

from __future__ import annotations

import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
TOOL_DIR = ROOT / "tools" / "playback-parity-v1"
PACKAGE_PATH = ROOT / "package.json"
WORKFLOW_PATH = ROOT / ".github" / "workflows" / "playback-shadow-ci.yml"
ARTIFACT_DIR = TOOL_DIR / ".playback-shadow-artifacts"

GATES = [
    "playback_planner_fixture_schema.py",
    "playback_shadow_planner_gate.py",
    "playback_js_vs_hs_shadow_compare.py",
    "playback_route_inventory_schema_gate.py",
    "playback_route_fixture_schema_gate.py",
    "inactive_playback_route_fixture_coverage_audit.py",
    "inactive_playback_route_fixture_pr_summary.py",
    "run_inactive_route_fixture_review_pack.py",
    "playback_route_contract_crosscheck.py",
    "playback_route_contract_js_vs_hs_compare.py",
    "playback_route_shadow_full_gate.py",
    "run_playback_shadow_ci.py",
    "run_playback_shadow_review_pack.py",
    "playback_shadow_workflow_safety_audit.py",
    "collect_playback_shadow_artifacts.py",
    "playback_shadow_artifact_manifest.py",
]

REPORTS = [
    ("ci_report", "playback-shadow-ci-report-*.txt"),
    ("review_pack_report", "playback-shadow-review-pack-report-*.txt"),
    ("workflow_safety_report", "playback-shadow-workflow-safety-report-*.txt"),
    ("artifact_manifest_report", "playback-shadow-artifact-manifest-report-*.txt"),
    ("pr_summary", "playback-shadow-pr-summary-*.md"),
    ("planner_compare_report", "playback-js-vs-hs-shadow-compare-report-*.txt"),
    ("route_compare_report", "playback-route-contract-js-vs-hs-report-*.txt"),
    ("route_inventory_schema_report", "playback-route-inventory-schema-report-*.txt"),
    ("route_fixture_schema_report", "playback-route-fixture-schema-report-*.txt"),
    ("inactive_route_fixture_coverage_report", "inactive-playback-route-fixture-coverage-report-*.txt"),
    ("inactive_route_fixture_pr_summary", "inactive-playback-route-fixture-pr-summary-*.md"),
    ("inactive_route_fixture_review_pack_report", "inactive-route-fixture-review-pack-report-*.txt"),
    ("route_crosscheck_report", "playback-route-contract-crosscheck-report-*.txt"),
]

NPM_SCRIPTS = [
    "test:playback-shadow",
    "test:playback-shadow-review",
    "collect:playback-shadow-artifacts",
    "report:playback-shadow-artifacts",
    "report:playback-shadow-readiness",
    "test:playback-inactive-route-fixtures",
    "report:playback-inactive-route-fixtures",
    "test:playback-inactive-route-fixture-review",
    "test:playback-fixture-readiness",
]

REVIEWER_DOCS = [
    ("playback_artifact_inspection", "playback-shadow-artifact-inspection.md"),
    ("playback_shadow_reviewer_checklist", "playback-shadow-review-checklist.md"),
    ("inactive_route_fixture_reviewer_checklist", "inactive-playback-route-fixture-review-checklist.md"),
]

FIXTURE_PATH = TOOL_DIR / "playback-route-contract-fixtures.json"


def latest(pattern: str) -> Path | None:
    matches = sorted(TOOL_DIR.glob(pattern), key=lambda path: path.stat().st_mtime)
    return matches[-1] if matches else None


def status_line(path: Path | None) -> str:
    if path is None:
        return "Status: MISSING"
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.startswith("Status:"):
            return line
    return "Status: UNKNOWN"


def package_scripts() -> dict[str, str]:
    package = json.loads(PACKAGE_PATH.read_text(encoding="utf-8"))
    scripts = package.get("scripts", {})
    return scripts if isinstance(scripts, dict) else {}


def fixture_count_summary() -> tuple[list[str], list[str]]:
    failures: list[str] = []
    if not FIXTURE_PATH.exists():
        return [f"- fixture_path: missing {FIXTURE_PATH.relative_to(ROOT)}"], ["missing playback route fixtures"]
    fixtures = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
    if not isinstance(fixtures, list):
        return [f"- fixture_path: {FIXTURE_PATH.relative_to(ROOT)} invalid"], ["fixture file is not a JSON array"]
    fixture_dicts = [fixture for fixture in fixtures if isinstance(fixture, dict)]
    valid_count = sum(1 for fixture in fixture_dicts if fixture.get("expectedValid") is True)
    invalid_count = sum(1 for fixture in fixture_dicts if fixture.get("expectedValid") is False)
    route_targets = sorted(
        {
            str(fixture.get("routeTarget"))
            for fixture in fixture_dicts
            if fixture.get("expectedValid") is True and fixture.get("routeTarget")
        }
    )
    lines = [
        f"- fixture_path: {FIXTURE_PATH.relative_to(ROOT)}",
        f"- fixture_count: {len(fixture_dicts)}",
        f"- valid_fixture_count: {valid_count}",
        f"- invalid_fixture_count: {invalid_count}",
        f"- valid_route_targets: {route_targets}",
    ]
    return lines, failures


def report_path() -> Path:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    return TOOL_DIR / f"playback-shadow-readiness-index-{stamp}.txt"


def main() -> int:
    write_report = "--write-report" in sys.argv
    scripts = package_scripts()
    failures: list[str] = []

    gate_lines: list[str] = []
    for gate in GATES:
        path = TOOL_DIR / gate
        if not path.exists():
            failures.append(f"missing gate/script: {gate}")
        gate_lines.append(f"- {gate}: {'present' if path.exists() else 'missing'}")

    report_lines: list[str] = []
    for label, pattern in REPORTS:
        path = latest(pattern)
        status = status_line(path)
        if path is None:
            failures.append(f"missing latest report: {label}")
        elif status != "Status: PASS":
            failures.append(f"{label} latest report is not PASS: {status}")
        report_lines.append(f"- {label}: {path.relative_to(ROOT) if path else 'missing'} {status}")

    npm_lines: list[str] = []
    for script in NPM_SCRIPTS:
        command = scripts.get(script)
        if not command:
            failures.append(f"missing npm script: {script}")
        npm_lines.append(f"- {script}: {command or 'missing'}")

    reviewer_doc_lines: list[str] = []
    for label, relative in REVIEWER_DOCS:
        path = TOOL_DIR / relative
        if not path.exists():
            failures.append(f"missing reviewer doc: {relative}")
        reviewer_doc_lines.append(f"- {label}: {path.relative_to(ROOT) if path.exists() else 'missing'}")

    fixture_lines, fixture_failures = fixture_count_summary()
    failures.extend(fixture_failures)

    workflow_text = WORKFLOW_PATH.read_text(encoding="utf-8") if WORKFLOW_PATH.exists() else ""
    cabal_version_pinned = "cabal-version:" in workflow_text
    cabal_update_disabled = "cabal-update: false" in workflow_text
    upload_path_fixed = "path: tools/playback-parity-v1/.playback-shadow-artifacts/**" in workflow_text
    upload_hidden_files = "include-hidden-files: true" in workflow_text
    workflow_summary = [
        f"- workflow_file: {WORKFLOW_PATH.relative_to(ROOT) if WORKFLOW_PATH.exists() else 'missing'}",
        f"- pull_request_trigger: {str('pull_request:' in workflow_text).lower()}",
        f"- workflow_dispatch_trigger: {str('workflow_dispatch:' in workflow_text).lower()}",
        f"- contents_read_permission: {str('contents: read' in workflow_text).lower()}",
        f"- upload_artifact: {str('actions/upload-artifact@v4' in workflow_text).lower()}",
        f"- step_summary: {str('GITHUB_STEP_SUMMARY' in workflow_text).lower()}",
        f"- haskell_setup_ghc_9_6_7: {str('ghc-version: 9.6.7' in workflow_text).lower()}",
        f"- haskell_setup_no_pinned_cabal_version: {str(not cabal_version_pinned).lower()}",
        f"- cabal_update_disabled_or_non_blocking: {str(cabal_update_disabled).lower()}",
        f"- artifact_upload_path_fixed: {str(upload_path_fixed).lower()}",
        f"- artifact_upload_hidden_files_enabled: {str(upload_hidden_files).lower()}",
    ]
    for expected, present in [
        ("workflow file", WORKFLOW_PATH.exists()),
        ("pull_request trigger", "pull_request:" in workflow_text),
        ("workflow_dispatch trigger", "workflow_dispatch:" in workflow_text),
        ("contents read permission", "contents: read" in workflow_text),
        ("artifact upload", "actions/upload-artifact@v4" in workflow_text),
        ("step summary", "GITHUB_STEP_SUMMARY" in workflow_text),
        ("Haskell setup GHC 9.6.7", "ghc-version: 9.6.7" in workflow_text),
        ("no pinned Cabal version", not cabal_version_pinned),
        ("Cabal update disabled", cabal_update_disabled),
        ("fixed artifact upload path", upload_path_fixed),
        ("hidden artifact files enabled", upload_hidden_files),
    ]:
        if not present:
            failures.append(f"missing workflow readiness item: {expected}")

    artifact_manifest = ARTIFACT_DIR / "manifest.txt"
    artifact_summary = [
        f"- artifact_dir: {ARTIFACT_DIR.relative_to(ROOT)}",
        f"- manifest: {artifact_manifest.relative_to(ROOT) if artifact_manifest.exists() else 'missing'}",
        f"- manifest_status: {status_line(artifact_manifest) if artifact_manifest.exists() else 'Status: MISSING'}",
    ]
    artifact_files = sorted(path.name for path in ARTIFACT_DIR.glob("*") if path.is_file()) if ARTIFACT_DIR.exists() else []
    artifact_summary.extend(f"- artifact_file: {name}" for name in artifact_files)
    if not artifact_manifest.exists():
        failures.append("missing artifact manifest")
    elif status_line(artifact_manifest) != "Status: PASS":
        failures.append(f"artifact manifest is not PASS: {status_line(artifact_manifest)}")

    ok = not failures
    lines = [
        f"Status: {'PASS' if ok else 'FAIL'}",
        "mode: read-only playback shadow readiness index",
        "server_started: no",
        "network_called: no",
        "ffmpeg_started: no",
        "runtime_playback_changed: no",
        "active_routes_added: no",
        "",
        "gates_available:",
        *gate_lines,
        "",
        "latest_reports:",
        *report_lines,
        "",
        "npm_scripts_available:",
        *npm_lines,
        "",
        "reviewer_docs_available:",
        *reviewer_doc_lines,
        "",
        "fixture_count_summary:",
        *fixture_lines,
        "",
        "safety_invariant_summary:",
        "- no active runtime wiring",
        "- no production frontend playback changes",
        "- no server startup",
        "- no FTP/live URL calls",
        "- no FFmpeg calls",
        "- no secrets or write permissions",
        "- no package dependency/version changes",
        "",
        "workflow_status_summary:",
        *workflow_summary,
        "",
        "artifact_manifest_status:",
        *artifact_summary,
        "",
        "reviewer_next_steps:",
        "- Run npm run test:playback-shadow.",
        "- Run npm run test:playback-shadow-review.",
        "- Run npm run collect:playback-shadow-artifacts.",
        "- Run npm run report:playback-shadow-artifacts.",
        "- Inspect tools/playback-parity-v1/README.md and playback-shadow-artifact-inspection.md.",
        "- Confirm no production runtime playback files changed before advancing to implementation planning.",
        "",
        f"remaining_blockers: {failures if failures else []}",
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

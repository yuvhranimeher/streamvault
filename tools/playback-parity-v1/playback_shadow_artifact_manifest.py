#!/usr/bin/env python3
"""Validate the collected playback shadow artifact manifest."""

from __future__ import annotations

import sys
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
TOOL_DIR = ROOT / "tools" / "playback-parity-v1"
ARTIFACT_DIR = TOOL_DIR / ".playback-shadow-artifacts"

EXPECTED = [
    ("manifest", "manifest.txt"),
    ("ci_report", "playback-shadow-ci-report-*.txt"),
    ("pr_summary", "playback-shadow-pr-summary-*.md"),
    ("review_pack_report", "playback-shadow-review-pack-report-*.txt"),
    ("workflow_safety_report", "playback-shadow-workflow-safety-report-*.txt"),
    ("js_haskell_planner_compare", "playback-js-vs-hs-shadow-compare-report-*.txt"),
    ("route_contract_compare", "playback-route-contract-js-vs-hs-report-*.txt"),
    ("inactive_route_fixture_coverage_audit", "inactive-playback-route-fixture-coverage-report-*.txt"),
    ("inactive_route_fixture_pr_summary", "inactive-playback-route-fixture-pr-summary-*.md"),
    ("inactive_route_fixture_review_pack", "inactive-route-fixture-review-pack-report-*.txt"),
]


def report_path() -> Path:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    return TOOL_DIR / f"playback-shadow-artifact-manifest-report-{stamp}.txt"


def status_line(path: Path) -> str:
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.startswith("Status:"):
            return line
    return "Status: UNKNOWN"


def main() -> int:
    write_report = "--write-report" in sys.argv
    failures: list[str] = []
    artifact_lines: list[str] = []

    if not ARTIFACT_DIR.is_dir():
        failures.append(f"missing artifact directory: {ARTIFACT_DIR.relative_to(ROOT)}")
        files: list[Path] = []
    else:
        files = sorted(path for path in ARTIFACT_DIR.iterdir() if path.is_file())

    for label, pattern in EXPECTED:
        matches = sorted(ARTIFACT_DIR.glob(pattern)) if ARTIFACT_DIR.is_dir() else []
        if not matches:
            failures.append(f"missing {label}: {pattern}")
            artifact_lines.append(f"- {label}: missing pattern={pattern}")
            continue
        if len(matches) > 1 and label != "manifest":
            failures.append(f"multiple {label} files: {[path.name for path in matches]}")
        for path in matches:
            status = status_line(path)
            if status != "Status: PASS":
                failures.append(f"{label} is not PASS: {path.name} {status}")
            artifact_lines.append(f"- {label}: {path.relative_to(ROOT)} {status}")

    manifest = ARTIFACT_DIR / "manifest.txt"
    if manifest.exists():
        manifest_text = manifest.read_text(encoding="utf-8")
        for expected_text in [
            "ci-report",
            "pr-summary",
            "review-pack-report",
            "workflow-safety-report",
            "js-haskell-planner-compare",
            "route-contract-compare",
            "inactive-route-fixture-coverage-audit",
            "inactive-route-fixture-pr-summary",
            "inactive-route-fixture-review-pack",
        ]:
            if expected_text not in manifest_text:
                failures.append(f"manifest missing entry: {expected_text}")

    ok = not failures
    lines = [
        f"Status: {'PASS' if ok else 'FAIL'}",
        "mode: read-only playback shadow artifact manifest validator",
        "server_started: no",
        "network_called: no",
        "ffmpeg_started: no",
        "runtime_playback_changed: no",
        "active_routes_added: no",
        f"artifact_dir: {ARTIFACT_DIR.relative_to(ROOT)}",
        f"artifact_file_count: {len(files)}",
        "artifacts:",
        *artifact_lines,
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

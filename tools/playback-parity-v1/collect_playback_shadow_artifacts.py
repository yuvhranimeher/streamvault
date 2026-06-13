#!/usr/bin/env python3
"""Collect latest playback shadow reports into a small artifact folder."""

from __future__ import annotations

import shutil
import sys
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
TOOL_DIR = ROOT / "tools" / "playback-parity-v1"
ARTIFACT_DIR = TOOL_DIR / ".playback-shadow-artifacts"

REPORTS = [
    ("ci-report", "playback-shadow-ci-report-*.txt"),
    ("pr-summary", "playback-shadow-pr-summary-*.md"),
    ("review-pack-report", "playback-shadow-review-pack-report-*.txt"),
    ("workflow-safety-report", "playback-shadow-workflow-safety-report-*.txt"),
    ("js-haskell-planner-compare", "playback-js-vs-hs-shadow-compare-report-*.txt"),
    ("route-contract-compare", "playback-route-contract-js-vs-hs-report-*.txt"),
    ("inactive-route-fixture-coverage-audit", "inactive-playback-route-fixture-coverage-report-*.txt"),
    ("inactive-route-fixture-pr-summary", "inactive-playback-route-fixture-pr-summary-*.md"),
    ("inactive-route-fixture-review-pack", "inactive-route-fixture-review-pack-report-*.txt"),
]

STATIC_ARTIFACTS = [
    ("inactive-route-fixture-review-checklist", "inactive-playback-route-fixture-review-checklist.md"),
]


def latest_match(pattern: str) -> Path | None:
    matches = sorted(TOOL_DIR.glob(pattern), key=lambda path: path.stat().st_mtime)
    return matches[-1] if matches else None


def status_line(path: Path | None) -> str:
    if path is None:
        return "Status: MISSING"
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.startswith("Status:"):
            return line
    return "Status: UNKNOWN"


def main() -> int:
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    for existing in ARTIFACT_DIR.iterdir():
        if existing.is_file():
            existing.unlink()

    failures: list[str] = []
    manifest_lines = [
        f"Status: PASS",
        "mode: read-only playback shadow artifact collector",
        "server_started: no",
        "network_called: no",
        "ffmpeg_started: no",
        "runtime_playback_changed: no",
        "active_routes_added: no",
        f"generated_at: {datetime.now().isoformat(timespec='seconds')}",
        f"artifact_dir: {ARTIFACT_DIR.relative_to(ROOT)}",
        "artifacts:",
    ]

    copied: list[Path] = []
    for label, pattern in REPORTS:
        source = latest_match(pattern)
        if source is None:
            failures.append(f"missing report for {label}: {pattern}")
            manifest_lines.append(f"- {label}: missing pattern={pattern}")
            continue
        destination = ARTIFACT_DIR / source.name
        shutil.copy2(source, destination)
        copied.append(destination)
        manifest_lines.append(
            f"- {label}: source={source.relative_to(ROOT)} artifact={destination.relative_to(ROOT)} "
            f"{status_line(source)}"
        )

    for label, relative_path in STATIC_ARTIFACTS:
        source = TOOL_DIR / relative_path
        if not source.exists():
            failures.append(f"missing static artifact for {label}: {relative_path}")
            manifest_lines.append(f"- {label}: missing path={relative_path}")
            continue
        destination = ARTIFACT_DIR / source.name
        shutil.copy2(source, destination)
        copied.append(destination)
        manifest_lines.append(
            f"- {label}: source={source.relative_to(ROOT)} artifact={destination.relative_to(ROOT)}"
        )

    if failures:
        manifest_lines[0] = "Status: FAIL"
    manifest_lines.append(f"failures: {failures}")

    manifest_path = ARTIFACT_DIR / "manifest.txt"
    manifest_path.write_text("\n".join(manifest_lines) + "\n", encoding="utf-8")
    sys.stdout.write("\n".join(manifest_lines) + "\n")
    sys.stdout.write(f"manifest_path: {manifest_path.relative_to(ROOT)}\n")
    return 0 if not failures else 1


if __name__ == "__main__":
    raise SystemExit(main())

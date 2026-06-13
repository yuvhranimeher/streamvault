#!/usr/bin/env python3
"""Generate a reviewer-facing summary for inactive route fixture coverage."""

from __future__ import annotations

import json
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

from inactive_playback_route_fixture_coverage_audit import REQUIRED_COVERAGE, matching_names, text


ROOT = Path(__file__).resolve().parents[2]
TOOL_DIR = ROOT / "tools" / "playback-parity-v1"
FIXTURE_PATH = TOOL_DIR / "playback-route-contract-fixtures.json"
INVENTORY_PATH = TOOL_DIR / "playback-route-shadow-contract-inventory.json"
PACKAGE_PATH = ROOT / "package.json"
PACKAGE_LOCK_PATH = ROOT / "package-lock.json"
BASE_BRANCH = "haskell-playback-inactive-route-fixture-coverage-20260613-003827"

REPORT_PATTERNS = {
    "fixture_coverage_audit": "inactive-playback-route-fixture-coverage-report-*.txt",
    "inactive_route_gate": "inactive-playback-route-v1-gate-report-*.txt",
    "inactive_route_safety": "inactive-playback-route-v1-safety-report-*.txt",
    "route_comparator": "playback-route-contract-js-vs-hs-report-*.txt",
    "freeze_manifest": "playback-shadow-freeze-manifest-report-*.txt",
    "ci_gate": "playback-shadow-ci-report-*.txt",
    "review_pack": "playback-shadow-review-pack-report-*.txt",
    "workflow_safety": "playback-shadow-workflow-safety-report-*.txt",
}

PLACEHOLDER_URL_PREFIXES = (
    "ftp://media.example.test/",
    "http://media.example.test/",
    "http://live.example.test/",
    "local://library/",
    "file:///fixture/",
)

ACTIVE_RUNTIME_PREFIXES = (
    "server.js",
    "app/",
    "lib/",
    "middleware/",
    "public/",
    "routes/",
    "src/",
)
FRONTEND_PLAYBACK_FILES = {
    "public/app.js",
    "public/player.js",
    "public/details.js",
    "public/livetv.js",
    "public/movies-page-fix.js",
    "public/series-page-fix.js",
}


def run_git(args: list[str]) -> str:
    result = subprocess.run(
        ["git", *args],
        cwd=ROOT,
        check=False,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    return result.stdout.strip()


def report_path() -> Path:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    return TOOL_DIR / f"inactive-playback-route-fixture-pr-summary-{stamp}.md"


def latest_report(pattern: str) -> Path | None:
    matches = sorted(TOOL_DIR.glob(pattern), key=lambda path: path.stat().st_mtime)
    return matches[-1] if matches else None


def status_from_report(path: Path | None) -> str:
    if path is None:
        return "MISSING"
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.startswith("Status:"):
            return line.replace("Status:", "").strip()
    return "UNKNOWN"


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def changed_files() -> list[str]:
    files = set(run_git(["diff", "--name-only", f"{BASE_BRANCH}..HEAD"]).splitlines())
    files.update(run_git(["diff", "--name-only", "HEAD"]).splitlines())
    for line in run_git(["status", "--short"]).splitlines():
        if line.startswith(("?? ", "!! ")):
            files.add(line[3:].strip())
        elif len(line) > 3 and line[2] == " ":
            files.add(line[3:].strip())
        elif len(line) > 2 and line[1] == " ":
            files.add(line[2:].strip())
    return sorted(path for path in files if path.strip())


def tracked_files() -> list[str]:
    return [line for line in run_git(["ls-files"]).splitlines() if line.strip()]


def active_runtime_references() -> list[str]:
    references: list[str] = []
    for path in tracked_files():
        if path.startswith("node_modules/") or path.startswith("tools/"):
            continue
        if path == "server.js" or path.startswith(ACTIVE_RUNTIME_PREFIXES):
            full_path = ROOT / path
            if full_path.is_file() and "InactivePlaybackRouteV1" in full_path.read_text(
                encoding="utf-8", errors="ignore"
            ):
                references.append(path)
    return sorted(references)


def file_at(ref_name: str, path: str) -> str | None:
    result = subprocess.run(
        ["git", "show", f"{ref_name}:{path}"],
        cwd=ROOT,
        check=False,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    return result.stdout if result.returncode == 0 else None


def package_version_or_dependency_changes() -> list[str]:
    base_text = file_at(BASE_BRANCH, "package.json")
    if base_text is None:
        return ["could not read base package.json"]
    base_package = json.loads(base_text)
    head_package = load_json(PACKAGE_PATH)
    failures: list[str] = []
    for key in ("version", "dependencies", "devDependencies", "optionalDependencies", "peerDependencies"):
        if base_package.get(key) != head_package.get(key):
            failures.append(f"package.json {key} changed")
    if run_git(["diff", "--name-only", f"{BASE_BRANCH}..HEAD", "--", str(PACKAGE_LOCK_PATH.relative_to(ROOT))]):
        failures.append("package-lock.json changed")
    return failures


def safe_url_failures(fixtures: list[dict[str, Any]]) -> list[str]:
    failures: list[str] = []
    for fixture in fixtures:
        stream_url = text(fixture.get("streamUrl"))
        if not stream_url:
            continue
        if not stream_url.startswith(PLACEHOLDER_URL_PREFIXES):
            failures.append(f"{fixture.get('name')}: non-placeholder streamUrl {stream_url}")
    return failures


def main() -> int:
    write_report = "--write-report" in sys.argv
    fixtures_raw = load_json(FIXTURE_PATH)
    inventory_raw = load_json(INVENTORY_PATH)
    if not isinstance(fixtures_raw, list):
        raise SystemExit("Fixture file must contain a JSON array")
    if not isinstance(inventory_raw, dict) or not isinstance(inventory_raw.get("contracts"), list):
        raise SystemExit("Inventory file must contain a contracts array")

    fixtures = [fixture for fixture in fixtures_raw if isinstance(fixture, dict)]
    inventory_targets = [
        text(contract.get("target"))
        for contract in inventory_raw["contracts"]
        if isinstance(contract, dict) and text(contract.get("target"))
    ]
    valid_route_targets = sorted(
        {
            text(fixture.get("routeTarget"))
            for fixture in fixtures
            if fixture.get("expectedValid") is True and text(fixture.get("routeTarget"))
        }
    )
    invalid_fixtures = [
        text(fixture.get("name"))
        for fixture in fixtures
        if fixture.get("expectedValid") is False and text(fixture.get("name"))
    ]
    reports = {name: latest_report(pattern) for name, pattern in REPORT_PATTERNS.items()}
    statuses = {name: status_from_report(path) for name, path in reports.items()}
    coverage_lines: list[str] = []
    coverage_failures: list[str] = []
    for label, check in REQUIRED_COVERAGE:
        names = matching_names(fixtures, check)
        if not names:
            coverage_failures.append(f"missing coverage case: {label}")
        coverage_lines.append(f"- {label}: {'present' if names else 'missing'} fixtures={names}")

    files = changed_files()
    active_runtime_changes = sorted(
        path for path in files if path == "server.js" or path.startswith(ACTIVE_RUNTIME_PREFIXES)
    )
    frontend_changes = sorted(path for path in files if path in FRONTEND_PLAYBACK_FILES)
    runtime_references = active_runtime_references()

    blockers: list[str] = []
    blockers.extend(coverage_failures)
    blockers.extend(safe_url_failures(fixtures))
    blockers.extend(package_version_or_dependency_changes())
    if sorted(inventory_targets) != valid_route_targets:
        blockers.append(f"valid fixture route targets do not match inventory: {valid_route_targets}")
    if active_runtime_changes:
        blockers.append(f"active runtime files changed: {active_runtime_changes}")
    if frontend_changes:
        blockers.append(f"frontend playback files changed: {frontend_changes}")
    if runtime_references:
        blockers.append(f"inactive Haskell route referenced by active runtime: {runtime_references}")
    for label in [
        "fixture_coverage_audit",
        "inactive_route_gate",
        "inactive_route_safety",
        "route_comparator",
        "freeze_manifest",
        "ci_gate",
    ]:
        if statuses[label] != "PASS":
            blockers.append(f"{label} status is {statuses[label]}")

    branch = run_git(["branch", "--show-current"]) or "(unknown)"
    head = run_git(["rev-parse", "--short", "HEAD"]) or "(unknown)"
    blocker_lines = [f"- {blocker}" for blocker in blockers] if blockers else ["- None."]
    ok = not blockers
    lines = [
        "# Inactive Playback Route Fixture Coverage PR Summary",
        "",
        f"Status: {'PASS' if ok else 'FAIL'}",
        "",
        "## Branch Context",
        "",
        f"- Base branch: `{BASE_BRANCH}`",
        f"- Current branch: `{branch}`",
        f"- HEAD: `{head}`",
        "",
        "## Fixture Coverage",
        "",
        f"- Fixture count: {len(fixtures)}",
        f"- Invalid fixtures: {invalid_fixtures}",
        "",
        "## New Coverage Cases",
        "",
        *coverage_lines,
        "",
        "## Route Targets Covered",
        "",
        *[f"- `{target}`" for target in inventory_targets],
        "",
        "## Gate Status",
        "",
        f"- Fixture coverage audit status: {statuses['fixture_coverage_audit']}",
        f"- JS/Haskell route comparator status: {statuses['route_comparator']}",
        f"- Inactive route gate status: {statuses['inactive_route_gate']}",
        f"- Inactive safety status: {statuses['inactive_route_safety']}",
        f"- CI gate status: {statuses['ci_gate']}",
        f"- Freeze manifest status: {statuses['freeze_manifest']}",
        f"- Review pack status: {statuses['review_pack']}",
        f"- Workflow safety status: {statuses['workflow_safety']}",
        "",
        "## Latest Reports",
        "",
        *[
            f"- {label}: `{path.relative_to(ROOT) if path else 'missing'}`"
            for label, path in reports.items()
        ],
        "",
        "## Runtime Wiring Statement",
        "",
        "server_started: no",
        "network_called: no",
        "ffmpeg_started: no",
        "runtime_playback_changed: no",
        "active_routes_added: no",
        "inactive_route_wired: no",
        "",
        "This summary is read-only reviewer documentation for frozen fixture coverage.",
        "It does not register active HTTP routes, does not wire the inactive Haskell route into the Node server, and does not modify production frontend playback code.",
        "",
        "## Reviewer Checklist",
        "",
        "- [ ] Fixture coverage cases are present.",
        "- [ ] Invalid cases are present.",
        "- [ ] Fixtures use fake/local placeholder URLs only.",
        "- [ ] No active route wiring was added.",
        "- [ ] Production frontend playback code did not change.",
        "- [ ] Package dependency and version fields did not change.",
        "- [ ] No server startup was added.",
        "- [ ] No FTP/live URL calls were added.",
        "- [ ] No FFmpeg calls were added.",
        "- [ ] All fixture coverage gates pass.",
        "",
        "## Remaining Blockers",
        "",
        *blocker_lines,
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

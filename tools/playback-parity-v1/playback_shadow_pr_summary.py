#!/usr/bin/env python3
"""Generate a reviewer-facing playback shadow PR summary."""

from __future__ import annotations

import subprocess
import sys
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
TOOL_DIR = ROOT / "tools" / "playback-parity-v1"
BASE_BRANCH = "haskell-playback-inactive-route-fixture-coverage-20260613-003827"

REPORT_PATTERNS = {
    "ci_gate": "playback-shadow-ci-report-*.txt",
    "js_haskell_planner": "playback-js-vs-hs-shadow-compare-report-*.txt",
    "route_comparator": "playback-route-contract-js-vs-hs-report-*.txt",
    "workflow_safety": "playback-shadow-workflow-safety-report-*.txt",
    "error_taxonomy_compare": "inactive-playback-route-error-taxonomy-js-vs-hs-report-*.txt",
    "error_taxonomy_envelope": "inactive-playback-route-error-taxonomy-envelope-report-*.txt",
    "error_taxonomy_fixture_coverage": "inactive-playback-route-error-taxonomy-fixture-coverage-report-*.txt",
    "error_taxonomy_safety": "inactive-playback-route-error-taxonomy-safety-report-*.txt",
    "final_readiness_compare": "inactive-playback-route-final-readiness-js-vs-hs-report-*.txt",
    "final_readiness_safety": "inactive-playback-route-final-readiness-safety-report-*.txt",
    "final_readiness_report": "inactive-playback-route-final-readiness-report-*.txt",
}

GATE_LIST = [
    "playback_planner_fixture_schema.py",
    "playback_shadow_planner_gate.py",
    "playback_js_vs_hs_shadow_compare.py",
    "playback_route_inventory_schema_gate.py",
    "playback_route_fixture_schema_gate.py",
    "playback_route_contract_crosscheck.py",
    "playback_route_contract_js_vs_hs_compare.py",
    "playback_route_shadow_full_gate.py",
    "inactive_playback_route_error_taxonomy_js_vs_hs_compare.py",
    "inactive_playback_route_error_taxonomy_envelope_gate.py",
    "inactive_playback_route_error_taxonomy_fixture_coverage_audit.py",
    "inactive_playback_route_error_taxonomy_safety_gate.py",
    "inactive_playback_route_final_readiness_js_vs_hs_compare.py",
    "inactive_playback_route_final_readiness_safety_gate.py",
    "inactive_playback_route_final_readiness_report.py",
]


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


def extract_line(path: Path | None, prefix: str) -> str:
    if path is None:
        return ""
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.startswith(prefix):
            return line
    return ""


def report_path() -> Path:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    return TOOL_DIR / f"playback-shadow-pr-summary-{stamp}.md"


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


def main() -> int:
    write_report = "--write-report" in sys.argv
    branch = run_git(["branch", "--show-current"]) or "(unknown)"
    head = run_git(["rev-parse", "--short", "HEAD"]) or "(unknown)"
    reports = {name: latest_report(pattern) for name, pattern in REPORT_PATTERNS.items()}
    files = changed_files()

    ci_status = status_from_report(reports["ci_gate"])
    planner_status = status_from_report(reports["js_haskell_planner"])
    route_status = status_from_report(reports["route_comparator"])
    workflow_status = status_from_report(reports["workflow_safety"])
    error_taxonomy_statuses = {
        label: status_from_report(reports[label])
        for label in [
            "error_taxonomy_compare",
            "error_taxonomy_envelope",
            "error_taxonomy_fixture_coverage",
            "error_taxonomy_safety",
        ]
    }
    final_readiness_statuses = {
        label: status_from_report(reports[label])
        for label in [
            "final_readiness_compare",
            "final_readiness_safety",
            "final_readiness_report",
        ]
    }
    failed_gates = extract_line(reports["ci_gate"], "failed_gates:")
    workflow_forbidden = extract_line(reports["workflow_safety"], "forbidden_hits:")

    blockers: list[str] = []
    for label, status in [
        ("CI gate", ci_status),
        ("JS/Haskell planner comparator", planner_status),
        ("route contract comparator", route_status),
        ("workflow safety audit", workflow_status),
    ]:
        if status != "PASS":
            blockers.append(f"{label} status is {status}")
    for label, status in error_taxonomy_statuses.items():
        if status != "PASS":
            blockers.append(f"{label} status is {status}")
    for label, status in final_readiness_statuses.items():
        if status != "PASS":
            blockers.append(f"{label} status is {status}")
    if not files:
        blockers.append("No changed files detected against base branch")

    ok = not blockers
    blocker_lines = [f"- {blocker}" for blocker in blockers] if blockers else ["- None."]
    lines = [
        "# Playback Shadow PR Summary",
        "",
        f"Status: {'PASS' if ok else 'FAIL'}",
        "",
        "## Branch Context",
        "",
        f"- Base branch: `{BASE_BRANCH}`",
        f"- Current branch: `{branch}`",
        f"- HEAD: `{head}`",
        "",
        "## Gate List",
        "",
        *[f"- `{gate}`" for gate in GATE_LIST],
        "",
        "## Gate Status",
        "",
        f"- CI gate status: {ci_status}",
        f"- JS vs Haskell planner status: {planner_status}",
        f"- Route contract comparator status: {route_status}",
        f"- Workflow safety status: {workflow_status}",
        *[
            f"- {label.replace('_', ' ').title()} status: {status}"
            for label, status in error_taxonomy_statuses.items()
        ],
        *[
            f"- {label.replace('_', ' ').title()} status: {status}"
            for label, status in final_readiness_statuses.items()
        ],
        f"- CI failed gates: {failed_gates or 'not reported'}",
        f"- Workflow forbidden hits: {workflow_forbidden or 'not reported'}",
        "",
        "## Latest Reports",
        "",
        *[
            f"- {label}: `{path.relative_to(ROOT) if path else 'missing'}`"
            for label, path in reports.items()
        ],
        "",
        "## Changed Files",
        "",
        *[f"- `{path}`" for path in files],
        "",
        "## Runtime Safety Statement",
        "",
        "This review pack is limited to read-only playback shadow tooling, reports, docs, and npm script wiring.",
        "It does not add active HTTP routes, does not modify playback runtime behavior, and does not touch production frontend playback code.",
        "The preserved contract remains: desktop direct play keeps original FTP sources, mobile HLS is used only when required, and desktop playback does not automatically transcode.",
        "",
        "## No Server, Network, Or FFmpeg",
        "",
        "The local review-pack tools do not start the production Node server, do not call FTP or live URLs, and do not invoke FFmpeg.",
        "The GitHub Actions workflow only performs checkout/tool setup, `npm ci`, and the read-only playback shadow npm script.",
        "",
        "## Remaining Blockers",
        "",
        *blocker_lines,
        "",
        "## Reviewer Checklist",
        "",
        "- [ ] Confirm this branch does not modify `master`.",
        "- [ ] Confirm no production runtime files changed.",
        "- [ ] Confirm no active HTTP routes were added.",
        "- [ ] Confirm production frontend playback code was not touched.",
        "- [ ] Confirm package versions and dependencies did not change.",
        "- [ ] Confirm CI runner status is PASS.",
        "- [ ] Confirm workflow safety status is PASS.",
        "- [ ] Confirm JS/Haskell planner comparator status is PASS.",
        "- [ ] Confirm route contract comparator status is PASS.",
        "",
        "## Next Safe Migration Step",
        "",
        "After review, add a PR-comment or artifact publishing layer for these summaries, still without changing playback runtime behavior.",
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

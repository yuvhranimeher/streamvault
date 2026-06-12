#!/usr/bin/env python3
"""Audit the playback shadow GitHub Actions workflow for read-only safety."""

from __future__ import annotations

import re
import sys
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
TOOL_DIR = ROOT / "tools" / "playback-parity-v1"
WORKFLOW_PATH = ROOT / ".github" / "workflows" / "playback-shadow-ci.yml"

FORBIDDEN_PATTERNS = {
    "push_trigger": r"(?m)^\s*push\s*:",
    "pull_requests_write_permission": r"(?ms)^\s*pull-requests:\s*write\s*$",
    "issues_write_permission": r"(?ms)^\s*issues:\s*write\s*$",
    "contents_write_permission": r"(?ms)^\s*contents:\s*write\s*$",
    "secrets_reference": r"\bsecrets\.",
    "npm_audit_fix": r"\bnpm\s+audit\s+fix\b",
    "npm_start": r"\bnpm\s+(?:run\s+)?start\b",
    "node_server": r"\bnode\s+server\.js\b",
    "server_js_execution": r"\bserver\.js\b",
    "deploy_keyword": r"\bdeploy(?:ment)?\b",
    "production_keyword": r"\bproduction\b",
    "github_script": r"actions/github-script",
    "gh_cli_pr_comment": r"\bgh\s+pr\s+comment\b",
    "gh_cli_issue_comment": r"\bgh\s+issue\s+comment\b",
    "github_pr_comment_api": r"/issues/\$\{\{\s*github\.event\.pull_request\.number\s*\}/comments",
    "route_execution_curl": r"\bcurl\b",
    "route_execution_wget": r"\bwget\b",
    "playback_api_route_call": r"/api/playback/",
    "ftp_raw_route_call": r"/api/ftp/raw",
    "live_route_call": r"/live/",
}


def report_path() -> Path:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    return TOOL_DIR / f"playback-shadow-workflow-safety-report-{stamp}.txt"


def has_trigger(text: str, trigger: str) -> bool:
    return re.search(rf"(?m)^\s{{2}}{re.escape(trigger)}\s*:", text) is not None


def trigger_block(text: str) -> list[str]:
    in_on = False
    triggers: list[str] = []
    for line in text.splitlines():
        if re.match(r"^on:\s*$", line):
            in_on = True
            continue
        if in_on and line and not line.startswith(" "):
            break
        if in_on:
            match = re.match(r"^\s{2}([A-Za-z_]+)\s*:", line)
            if match:
                triggers.append(match.group(1))
    return triggers


def main() -> int:
    write_report = "--write-report" in sys.argv
    if not WORKFLOW_PATH.exists():
        raise SystemExit(f"Missing workflow: {WORKFLOW_PATH.relative_to(ROOT)}")

    text = WORKFLOW_PATH.read_text(encoding="utf-8")
    failures: list[str] = []
    triggers = trigger_block(text)
    allowed_triggers = {"pull_request", "workflow_dispatch"}

    if set(triggers) != allowed_triggers:
        failures.append(f"workflow triggers must be exactly {sorted(allowed_triggers)}, got {triggers}")
    if not has_trigger(text, "pull_request"):
        failures.append("missing pull_request trigger")
    if not has_trigger(text, "workflow_dispatch"):
        failures.append("missing workflow_dispatch trigger")
    if not re.search(r"(?ms)^permissions:\s*\n\s{2}contents:\s*read\s*$", text):
        failures.append("missing top-level contents: read permission")
    if "npm ci" not in text:
        failures.append("missing npm ci install step")
    if "npm run test:playback-shadow" not in text:
        failures.append("missing playback shadow npm script step")
    if "npm run test:playback-shadow-review" not in text:
        failures.append("missing playback shadow review npm script step")
    if "collect_playback_shadow_artifacts.py" not in text:
        failures.append("missing artifact collector step")
    if "actions/upload-artifact@v4" not in text:
        failures.append("missing upload-artifact step")
    if "GITHUB_STEP_SUMMARY" not in text:
        failures.append("missing GitHub step summary")
    if "playback-shadow-review-pack" not in text:
        failures.append("missing playback shadow artifact name")
    if "ghc-version: 9.6.7" not in text:
        failures.append("missing GHC 9.6.7 setup")

    forbidden_hits: dict[str, list[str]] = {}
    for name, pattern in FORBIDDEN_PATTERNS.items():
        matches = re.findall(pattern, text, flags=re.IGNORECASE)
        if matches:
            forbidden_hits[name] = matches
            failures.append(f"forbidden workflow content: {name}")

    ok = not failures
    lines = [
        f"Status: {'PASS' if ok else 'FAIL'}",
        "mode: read-only playback shadow workflow safety audit",
        "server_started: no",
        "network_called: no",
        "ffmpeg_started: no",
        "runtime_playback_changed: no",
        "active_routes_added: no",
        f"workflow_path: {WORKFLOW_PATH.relative_to(ROOT)}",
        f"triggers: {triggers}",
        "required_permissions: contents: read",
        "workflow_must_not_deploy: true",
        "workflow_must_not_start_server: true",
        "workflow_must_not_use_secrets: true",
        "upload_artifact_allowed: true",
        "github_step_summary_allowed: true",
        "pr_comments_avoided: true",
        f"forbidden_hits: {forbidden_hits}",
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

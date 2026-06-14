#!/usr/bin/env python3
"""Validate inactive playback route activation planning prerequisites."""

from __future__ import annotations

import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
TOOL_DIR = ROOT / "tools" / "playback-parity-v1"
CONTRACT_JSON_PATH = TOOL_DIR / "inactive-playback-route-activation-plan-contract.json"
CONTRACT_MD_PATH = TOOL_DIR / "inactive-playback-route-activation-plan-contract.md"
CHECKLIST_PATH = TOOL_DIR / "inactive-playback-route-activation-checklist.md"
BOUNDARY_PATH = TOOL_DIR / "inactive-playback-route-activation-runtime-boundary.json"
ROLLBACK_PATH = TOOL_DIR / "inactive-playback-route-activation-rollback-plan.md"
RISK_PATH = TOOL_DIR / "inactive-playback-route-activation-risk-matrix.json"
PACKAGE_PATH = ROOT / "package.json"

EXPECTED_FUTURE_FILES = [
    "server.js",
    "routes/inactive-playback-route-haskell.js",
    "routes/inactive-playback-route-flags.js",
]
EXPECTED_NO_TOUCH = [
    "server.js",
    "public/app.js",
    "public/details.js",
    "public/player.js",
    "public/livetv.js",
    "public/movies-page-fix.js",
    "public/series-page-fix.js",
    "routes/dashboard.js",
    "middleware/tracker.js",
]
EXPECTED_PREFIXES = ["public/", "routes/", "middleware/", "src/", "lib/"]
EXPECTED_FLAG = "STREAMVAULT_INACTIVE_HASKELL_PLAYBACK_ROUTE"
EXPECTED_RISK_IDS = {
    "desktop-direct-play-regression",
    "mobile-hls-regression",
    "ffmpeg-desktop-activation",
    "live-url-activation",
    "runtime-wiring-without-flag",
    "rollback-path-unclear",
}
EXPECTED_SCRIPT = (
    "python3 tools/playback-parity-v1/inactive_playback_route_activation_plan_prerequisites.py --write-report "
    "&& python3 tools/playback-parity-v1/inactive_playback_route_activation_plan_dependency_checker.py --write-report "
    "&& python3 tools/playback-parity-v1/inactive_playback_route_activation_plan_safety_gate.py --write-report "
    "&& python3 tools/playback-parity-v1/inactive_playback_route_activation_plan_report.py --write-report"
)


def report_path() -> Path:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    return TOOL_DIR / f"inactive-playback-route-activation-plan-prerequisites-report-{stamp}.txt"


def load_json(path: Path) -> tuple[Any | None, str | None]:
    try:
        return json.loads(path.read_text(encoding="utf-8")), None
    except (OSError, json.JSONDecodeError) as exc:
        return None, str(exc)


def text_contains(path: Path, terms: list[str]) -> list[str]:
    try:
        text = path.read_text(encoding="utf-8").lower()
    except OSError as exc:
        return [f"{path.relative_to(ROOT)} could not be read: {exc}"]
    missing = [term for term in terms if term.lower() not in text]
    return [f"{path.relative_to(ROOT)} missing term: {term}" for term in missing]


def package_failures() -> list[str]:
    package, err = load_json(PACKAGE_PATH)
    if err or not isinstance(package, dict):
        return [f"package.json could not be parsed: {err or 'expected object'}"]
    scripts = package.get("scripts", {})
    if not isinstance(scripts, dict):
        return ["package.json scripts must be an object"]
    actual = scripts.get("test:playback-inactive-route-activation-plan")
    if actual != EXPECTED_SCRIPT:
        return ["activation-plan npm script missing or different from contract"]
    return []


def contract_failures(contract: Any) -> list[str]:
    failures: list[str] = []
    if not isinstance(contract, dict):
        return ["activation plan contract must be a JSON object"]
    if contract.get("contractId") != "inactive-playback-route-activation-plan-v1":
        failures.append("contractId mismatch")
    if contract.get("mode") != "read-only activation planning only":
        failures.append("contract mode must be read-only activation planning only")
    if contract.get("activationStatus") != "not-active":
        failures.append("activationStatus must be not-active")
    if contract.get("futureActivationFiles") != EXPECTED_FUTURE_FILES:
        failures.append(f"futureActivationFiles mismatch: {contract.get('futureActivationFiles')}")
    must_not_touch = contract.get("mustNotTouchYet")
    if not isinstance(must_not_touch, list) or not all(item in must_not_touch for item in EXPECTED_NO_TOUCH):
        failures.append("mustNotTouchYet is missing required runtime files")
    flag = contract.get("featureFlag")
    if not isinstance(flag, dict) or flag.get("name") != EXPECTED_FLAG or flag.get("default") != "off":
        failures.append("feature flag contract must default off")
    for command in [
        "npm run test:playback-shadow",
        "npm run test:playback-shadow-review",
        "npm run test:playback-inactive-route-final-readiness",
        "npm run test:playback-inactive-route-implementation-shadow",
        "npm run test:playback-inactive-route-activation-plan",
    ]:
        if command not in contract.get("requiredPreActivationGates", []):
            failures.append(f"missing pre-activation gate: {command}")
    for path_text in contract.get("requiredDocuments", []) + contract.get("validators", []):
        if not isinstance(path_text, str) or not (ROOT / path_text).exists():
            failures.append(f"contract references missing file: {path_text}")
    return failures


def boundary_failures(boundary: Any) -> list[str]:
    failures: list[str] = []
    if not isinstance(boundary, dict):
        return ["runtime boundary manifest must be a JSON object"]
    if boundary.get("planningOnly") is not True:
        failures.append("runtime boundary must be planningOnly")
    if boundary.get("activationStatus") != "not-active":
        failures.append("runtime boundary activationStatus must be not-active")
    future_paths = [
        entry.get("path")
        for entry in boundary.get("futureActivationFiles", [])
        if isinstance(entry, dict)
    ]
    if future_paths != EXPECTED_FUTURE_FILES:
        failures.append(f"runtime boundary futureActivationFiles mismatch: {future_paths}")
    must_not_touch = boundary.get("mustNotTouchYet")
    if not isinstance(must_not_touch, list) or not all(path in must_not_touch for path in EXPECTED_NO_TOUCH):
        failures.append("runtime boundary mustNotTouchYet is incomplete")
    prefixes = boundary.get("mustNotTouchYetPrefixes")
    if prefixes != EXPECTED_PREFIXES:
        failures.append(f"runtime boundary prefixes mismatch: {prefixes}")
    flag = boundary.get("featureFlag")
    if not isinstance(flag, dict) or flag.get("name") != EXPECTED_FLAG:
        failures.append("runtime boundary feature flag name mismatch")
    elif flag.get("default") != "off" or flag.get("planningValue") != "off":
        failures.append("runtime boundary feature flag must be off during planning")
    for phrase in [
        "active route registration",
        "frontend playback behavior change",
        "FFmpeg behavior change",
        "FTP or live URL activation",
        "network call",
        "Cloudflare or tunnel configuration change",
    ]:
        if phrase not in boundary.get("planningForbiddenActions", []):
            failures.append(f"missing forbidden planning action: {phrase}")
    return failures


def risk_failures(risk: Any) -> list[str]:
    failures: list[str] = []
    if not isinstance(risk, dict):
        return ["risk matrix must be a JSON object"]
    if risk.get("planningOnly") is not True:
        failures.append("risk matrix must be planningOnly")
    risks = risk.get("risks")
    if not isinstance(risks, list):
        return [*failures, "risk matrix risks must be an array"]
    observed_ids = {item.get("id") for item in risks if isinstance(item, dict)}
    missing = sorted(EXPECTED_RISK_IDS - observed_ids)
    if missing:
        failures.append(f"risk matrix missing ids: {missing}")
    for item in risks:
        if not isinstance(item, dict):
            failures.append("risk matrix contains non-object entry")
            continue
        for field in ["id", "severity", "description", "mitigation", "verification"]:
            if not isinstance(item.get(field), str) or not item.get(field):
                failures.append(f"{item.get('id', 'unknown')}: missing {field}")
    return failures


def main() -> int:
    write_report = "--write-report" in sys.argv
    contract, contract_err = load_json(CONTRACT_JSON_PATH)
    boundary, boundary_err = load_json(BOUNDARY_PATH)
    risk, risk_err = load_json(RISK_PATH)
    failures: list[str] = []

    for path in [CONTRACT_MD_PATH, CHECKLIST_PATH, ROLLBACK_PATH]:
        if not path.exists():
            failures.append(f"missing document: {path.relative_to(ROOT)}")
    failures.extend([f"contract JSON parse failure: {contract_err}"] if contract_err else [])
    failures.extend([f"runtime boundary parse failure: {boundary_err}"] if boundary_err else [])
    failures.extend([f"risk matrix parse failure: {risk_err}"] if risk_err else [])
    failures.extend(contract_failures(contract))
    failures.extend(boundary_failures(boundary))
    failures.extend(risk_failures(risk))
    failures.extend(package_failures())

    failures.extend(text_contains(CONTRACT_MD_PATH, [EXPECTED_FLAG, "not activation", "future activation files", "ffmpeg"]))
    failures.extend(text_contains(CHECKLIST_PATH, ["desktop ftp direct-play", "mobile hls", "emergency disable", "feature flag"]))
    failures.extend(text_contains(ROLLBACK_PATH, ["primary rollback", EXPECTED_FLAG, "flag-off", "existing node playback"]))

    ok = not failures
    lines = [
        f"Status: {'PASS' if ok else 'FAIL'}",
        "mode: read-only inactive playback route activation plan prerequisites",
        "server_started: no",
        "network_called: no",
        "ffmpeg_started: no",
        "runtime_playback_changed: no",
        "active_routes_added: no",
        "activation_performed: no",
        f"contract_path: {CONTRACT_JSON_PATH.relative_to(ROOT)}",
        f"boundary_path: {BOUNDARY_PATH.relative_to(ROOT)}",
        f"risk_path: {RISK_PATH.relative_to(ROOT)}",
        f"future_activation_files: {EXPECTED_FUTURE_FILES}",
        f"feature_flag: {EXPECTED_FLAG}",
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

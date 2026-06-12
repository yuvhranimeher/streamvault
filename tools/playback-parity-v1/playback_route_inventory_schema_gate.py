#!/usr/bin/env python3
"""Read-only playback route inventory schema gate."""

from __future__ import annotations

import json
import sys
from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
TOOL_DIR = ROOT / "tools" / "playback-parity-v1"
INVENTORY_PATH = TOOL_DIR / "playback-route-shadow-contract-inventory.json"

RISK_LEVELS = {"low", "medium", "high"}
RESPONSE_KINDS = {"json-only", "may-stream-bytes"}
REQUIRED_CONTRACT_KEYS = {
    "target",
    "routeStatus",
    "expectedInputFields",
    "expectedOutputFields",
    "riskLevel",
    "jsSourceReferences",
    "futureHaskellMirrorName",
    "responseKind",
    "contractNotes",
}


def is_text(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())


def is_text_list(value: Any) -> bool:
    return isinstance(value, list) and bool(value) and all(is_text(item) for item in value)


def documented_non_api_contract(contract: dict[str, Any]) -> bool:
    target = str(contract.get("target") or "")
    status = str(contract.get("routeStatus") or "").lower()
    notes = " ".join(str(note).lower() for note in contract.get("contractNotes") or [])
    allowed_targets = {"live TV m3u8 playback", "series episode playback"}
    return target in allowed_targets and ("contract" in status or "contract" in notes)


def validate_contract(index: int, contract: dict[str, Any]) -> list[str]:
    failures: list[str] = []
    missing = sorted(REQUIRED_CONTRACT_KEYS - set(contract))
    if missing:
        failures.append(f"missing_keys:{','.join(missing)}")

    target = contract.get("target")
    if not is_text(target):
        failures.append("missing_target")
    elif not str(target).startswith("/api/") and not documented_non_api_contract(contract):
        failures.append("target_not_api_or_documented_live_contract")

    if not is_text(contract.get("routeStatus")):
        failures.append("missing_routeStatus")
    if not is_text_list(contract.get("expectedInputFields")):
        failures.append("missing_expectedInputFields")
    if not is_text_list(contract.get("expectedOutputFields")):
        failures.append("missing_expectedOutputFields")
    if contract.get("riskLevel") not in RISK_LEVELS:
        failures.append("invalid_riskLevel")
    if not is_text_list(contract.get("jsSourceReferences")):
        failures.append("missing_jsSourceReferences")
    if not is_text(contract.get("futureHaskellMirrorName")):
        failures.append("missing_futureHaskellMirrorName")
    if contract.get("responseKind") not in RESPONSE_KINDS:
        failures.append("invalid_responseKind")
    if not is_text_list(contract.get("contractNotes")):
        failures.append("missing_contractNotes")

    notes = " ".join(str(note).lower() for note in contract.get("contractNotes") or [])
    status = str(contract.get("routeStatus") or "").lower()
    if "implement" not in notes and "register" not in notes and "contract-only" not in status:
        failures.append("runtime_route_boundary_not_documented")

    for field_name in ("expectedInputFields", "expectedOutputFields"):
        fields = contract.get(field_name)
        if isinstance(fields, list):
            duplicates = sorted(name for name, count in Counter(fields).items() if count > 1)
            if duplicates:
                failures.append(f"duplicate_{field_name}:{','.join(duplicates)}")

    return failures


def report_path() -> Path:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    return TOOL_DIR / f"playback-route-inventory-schema-report-{stamp}.txt"


def main() -> int:
    write_report = "--write-report" in sys.argv
    inventory = json.loads(INVENTORY_PATH.read_text(encoding="utf-8"))
    failures: list[str] = []

    if not isinstance(inventory, dict):
        raise SystemExit("Inventory file must contain a JSON object")

    contracts = inventory.get("contracts")
    if not isinstance(contracts, list):
        raise SystemExit("Inventory file must contain a contracts array")

    if inventory.get("serverStarted") is not False:
        failures.append("inventory serverStarted must be false")
    if inventory.get("runtimePlaybackChanged") is not False:
        failures.append("inventory runtimePlaybackChanged must be false")
    if inventory.get("activeRoutesAdded") is not False:
        failures.append("inventory activeRoutesAdded must be false")

    targets = [contract.get("target") for contract in contracts if isinstance(contract, dict)]
    duplicate_targets = sorted(target for target, count in Counter(targets).items() if target and count > 1)
    for target in duplicate_targets:
        failures.append(f"duplicate route key: {target}")

    contract_lines: list[str] = []
    for index, contract in enumerate(contracts):
        if not isinstance(contract, dict):
            failures.append(f"contracts[{index}] is not an object")
            continue
        contract_failures = validate_contract(index, contract)
        failures.extend(f"{contract.get('target', f'contracts[{index}]')}: {failure}" for failure in contract_failures)
        contract_lines.append(
            f"- {contract.get('target')}: riskLevel={contract.get('riskLevel')} "
            f"responseKind={contract.get('responseKind')} mirror={contract.get('futureHaskellMirrorName')} "
            f"inputFields={len(contract.get('expectedInputFields') or [])} "
            f"outputFields={len(contract.get('expectedOutputFields') or [])} "
            f"jsRefs={len(contract.get('jsSourceReferences') or [])} failures={contract_failures}"
        )

    ok = not failures
    lines = [
        f"Status: {'PASS' if ok else 'FAIL'}",
        "mode: read-only playback route inventory schema gate",
        "server_started: no",
        "network_called: no",
        "runtime_playback_changed: no",
        "active_routes_added: no",
        f"inventory_path: {INVENTORY_PATH.relative_to(ROOT)}",
        f"contract_count: {len(contracts)}",
        f"duplicate_route_keys: {duplicate_targets}",
        f"allowed_risk_levels: {sorted(RISK_LEVELS)}",
        f"allowed_response_kinds: {sorted(RESPONSE_KINDS)}",
        "contracts:",
        *contract_lines,
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

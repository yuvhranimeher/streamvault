#!/usr/bin/env python3
"""Cross-check playback route inventory contracts against route fixtures."""

from __future__ import annotations

import json
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
TOOL_DIR = ROOT / "tools" / "playback-parity-v1"
INVENTORY_PATH = TOOL_DIR / "playback-route-shadow-contract-inventory.json"
FIXTURE_PATH = TOOL_DIR / "playback-route-contract-fixtures.json"


def report_path() -> Path:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    return TOOL_DIR / f"playback-route-contract-crosscheck-report-{stamp}.txt"


def fields(value: Any) -> list[str]:
    return value if isinstance(value, list) else []


def is_future_only(contract: dict[str, Any]) -> bool:
    status = str(contract.get("routeStatus") or "").lower()
    notes = " ".join(str(note).lower() for note in contract.get("contractNotes") or [])
    return "future-only" in status or "future-only" in notes


def main() -> int:
    write_report = "--write-report" in sys.argv
    inventory = json.loads(INVENTORY_PATH.read_text(encoding="utf-8"))
    fixtures = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
    if not isinstance(inventory, dict) or not isinstance(inventory.get("contracts"), list):
        raise SystemExit("Inventory must contain a contracts array")
    if not isinstance(fixtures, list):
        raise SystemExit("Fixture file must contain a JSON array")

    contracts = [item for item in inventory["contracts"] if isinstance(item, dict)]
    route_map = {contract.get("target"): contract for contract in contracts}
    fixtures_by_route: dict[str, list[dict[str, Any]]] = defaultdict(list)
    failures: list[str] = []

    for fixture in fixtures:
        if isinstance(fixture, dict):
            fixtures_by_route[str(fixture.get("routeTarget") or "")].append(fixture)

    for contract in contracts:
        target = str(contract.get("target") or "")
        if not fixtures_by_route.get(target) and not is_future_only(contract):
            failures.append(f"{target}: inventory contract has no fixture")

    fixture_lines: list[str] = []
    for route_target, route_fixtures in sorted(fixtures_by_route.items()):
        contract = route_map.get(route_target)
        if contract is None:
            failures.append(f"{route_target}: fixture route missing from inventory")
            continue
        for fixture in route_fixtures:
            name = fixture.get("name")
            if fixture.get("riskLevel") != contract.get("riskLevel"):
                failures.append(f"{name}: riskLevel {fixture.get('riskLevel')} != inventory {contract.get('riskLevel')}")
            if fixture.get("responseKind") != contract.get("responseKind"):
                failures.append(
                    f"{name}: responseKind {fixture.get('responseKind')} != inventory {contract.get('responseKind')}"
                )
            if fixture.get("futureHaskellMirrorName") != contract.get("futureHaskellMirrorName"):
                failures.append(f"{name}: futureHaskellMirrorName differs from inventory")
            if fields(fixture.get("expectedInputFields")) != fields(contract.get("expectedInputFields")):
                failures.append(f"{name}: expectedInputFields differ from inventory")
            if fields(fixture.get("expectedOutputFields")) != fields(contract.get("expectedOutputFields")):
                failures.append(f"{name}: expectedOutputFields differ from inventory")
            fixture_lines.append(
                f"- {name}: routeTarget={route_target} riskLevel={fixture.get('riskLevel')} "
                f"responseKind={fixture.get('responseKind')} mirror={fixture.get('futureHaskellMirrorName')}"
            )

    ok = not failures
    lines = [
        f"Status: {'PASS' if ok else 'FAIL'}",
        "mode: read-only playback route inventory/fixture crosscheck",
        "server_started: no",
        "network_called: no",
        "runtime_playback_changed: no",
        "active_routes_added: no",
        f"inventory_path: {INVENTORY_PATH.relative_to(ROOT)}",
        f"fixture_path: {FIXTURE_PATH.relative_to(ROOT)}",
        f"inventory_contract_count: {len(contracts)}",
        f"fixture_count: {sum(len(items) for items in fixtures_by_route.values())}",
        f"routes_with_fixtures: {sorted(route for route, items in fixtures_by_route.items() if items)}",
        "fixture_matches:",
        *fixture_lines,
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

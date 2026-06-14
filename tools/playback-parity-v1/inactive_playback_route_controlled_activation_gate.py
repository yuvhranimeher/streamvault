#!/usr/bin/env python3
import json
import subprocess
from pathlib import Path
from datetime import datetime

ROOT = Path(__file__).resolve().parents[2]
REPORT = ROOT / "tools/playback-parity-v1" / f"inactive-playback-route-controlled-activation-report-{datetime.now().strftime('%Y%m%d-%H%M%S')}.txt"

required_files = [
    "server.js",
    "routes/inactive-playback-route-flags.js",
    "routes/inactive-playback-route-haskell.js",
    "tools/playback-parity-v1/test_inactive_playback_route_controlled_activation.js",
]

forbidden_public_changes = [
    "public/app.js",
    "public/details.js",
    "public/player.js",
    "public/livetv.js",
]

failures = []

for rel in required_files:
    if not (ROOT / rel).exists():
        failures.append(f"missing required file: {rel}")

server = (ROOT / "server.js").read_text(errors="replace")
if "createInactivePlaybackRouteHaskellRouter" not in server:
    failures.append("server.js missing guarded inactive Haskell route bridge import/mount")
if "/api/playback/inactive-haskell" not in server:
    failures.append("server.js missing inactive Haskell route mount path")

flags = (ROOT / "routes/inactive-playback-route-flags.js").read_text(errors="replace")
if "STREAMVAULT_INACTIVE_HASKELL_PLAYBACK_ROUTE" not in flags:
    failures.append("feature flag helper missing STREAMVAULT_INACTIVE_HASKELL_PLAYBACK_ROUTE")
if "return 'off'" not in flags:
    failures.append("feature flag helper must fail closed to off")

bridge = (ROOT / "routes/inactive-playback-route-haskell.js").read_text(errors="replace")
for forbidden in ["spawn('ffmpeg'", 'spawn("ffmpeg"', "http.get", "https.get", "axios", "fetch("]:
    if forbidden in bridge:
        failures.append(f"bridge contains forbidden runtime/network/ffmpeg token: {forbidden}")

for rel in forbidden_public_changes:
    if (ROOT / rel).exists():
        diff = subprocess.run(["git", "diff", "--name-only", "--", rel], cwd=ROOT, text=True, capture_output=True)
        if diff.stdout.strip():
            failures.append(f"forbidden frontend playback file changed: {rel}")

node = subprocess.run(
    ["node", "tools/playback-parity-v1/test_inactive_playback_route_controlled_activation.js"],
    cwd=ROOT,
    text=True,
    capture_output=True,
)
if node.returncode != 0:
    failures.append("node controlled activation gate failed")
    failures.append(node.stdout.strip())
    failures.append(node.stderr.strip())

status = "PASS" if not failures else "FAIL"
lines = [
    f"Status: {status}",
    "mode: controlled inactive Haskell playback activation gate",
    "server_started: no",
    "network_called: no",
    "ffmpeg_started: no",
    "runtime_playback_changed_when_flag_off: no",
    "feature_flag: STREAMVAULT_INACTIVE_HASKELL_PLAYBACK_ROUTE",
    "default: off",
    "mount_path: /api/playback/inactive-haskell",
    "node_gate_stdout:",
    node.stdout.strip(),
    "failures:",
    json.dumps(failures, indent=2),
]
REPORT.write_text("\n".join(lines) + "\n")
print(f"report_path: {REPORT.relative_to(ROOT)}")
print("\n".join(lines))
raise SystemExit(0 if not failures else 1)

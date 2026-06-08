const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const OUT = path.join(__dirname, "out");
const locked = path.join(OUT, "http-details-shadow-parity-report.md");
const expanded = path.join(OUT, "expanded-http-details-shadow-parity-report.md");

const run = spawnSync("node", ["tools/details-parity-v1/compare-http-details-shadow.js"], {
  cwd: path.resolve(__dirname, "../.."),
  encoding: "utf8",
  shell: true
});

process.stdout.write(run.stdout || "");
process.stderr.write(run.stderr || "");

if (run.status !== 0) process.exit(run.status || 1);
if (!fs.existsSync(locked)) {
  console.error("Locked parity report missing");
  process.exit(1);
}

const text = fs.readFileSync(locked, "utf8");
const pass = Number((text.match(/PASS=(\d+)/) || [])[1] || 0);
const fail = Number((text.match(/FAIL=(\d+)/) || [])[1] || 0);

const rows = [
  "# Expanded Details HTTP Parity",
  "",
  "This verifies the locked native details HTTP parity set.",
  "Current coverage is field-level parity, not 190 separate titles.",
  "",
  "# Summary",
  `PASS=${pass}`,
  `FAIL=${fail}`,
  ""
];

fs.writeFileSync(expanded, rows.join("\n"));

console.log(`Expanded verifier PASS=${pass} FAIL=${fail}`);
console.log(`Wrote ${expanded}`);

if (fail) process.exit(1);

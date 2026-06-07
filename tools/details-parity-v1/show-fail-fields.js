const fs = require("fs");
const path = require("path");

const file = path.join("tools", "details-parity-v1", "out", "details-parity-report.md");
if (!fs.existsSync(file)) {
  console.log("No parity report found yet.");
  process.exit(0);
}

const text = fs.readFileSync(file, "utf8");
const lines = text.split(/\r?\n/);

const fails = {};
for (const line of lines) {
  const m = line.match(/^- FAIL ([^:]+):/);
  if (m) fails[m[1]] = (fails[m[1]] || 0) + 1;
}

console.log("Current fail fields:");
console.table(fails);

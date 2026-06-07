const fs = require("fs");
const path = require("path");

const csv = path.join(__dirname, "out", "details-parity-summary.csv");
const out = path.join(__dirname, "out", "details-fail-samples.md");

const lines = fs.readFileSync(csv, "utf8").split(/\r?\n/).filter(Boolean);
const rows = lines.slice(1);

let md = "# Details Parity Fail Samples\n\n";
let count = 0;

for (const line of rows) {
  if (!line.endsWith(',"FAIL"')) continue;
  count++;

  const cols = line.match(/("([^"]|"")*"|[^,]+)/g) || [];
  const clean = s => String(s || "").replace(/^"|"$/g, "").replace(/""/g, '"');

  md += `## ${count}. ${clean(cols[0])}\n\n`;
  md += `- field: ${clean(cols[1])}\n`;
  md += `- node: ${clean(cols[2])}\n`;
  md += `- haskell: ${clean(cols[3])}\n\n`;
}

fs.writeFileSync(out, md);
console.log(`FAIL rows: ${count}`);
console.log(`Wrote ${out}`);

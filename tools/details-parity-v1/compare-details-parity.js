const fs = require("fs");
const path = require("path");

const NODE = path.join(__dirname, "out", "node-details-normalized.json");
const HASKELL = path.join(__dirname, "out", "haskell-details-normalized.json");
const OUT = path.join(__dirname, "out", "details-parity-report.md");

function readJson(p) {
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

const node = readJson(NODE);
const haskell = readJson(HASKELL);

let md = "# Details/TMDB Parity Report\n\n";
md += `Generated: ${new Date().toISOString()}\n\n`;

if (!node) {
  md += "Node normalized fixture missing.\n";
  fs.writeFileSync(OUT, md);
  process.exit(1);
}

if (!haskell) {
  md += "Haskell normalized fixture missing.\n\n";
  md += "Status: waiting for native Haskell details output.\n\n";
  md += `Node rows ready: ${node.items.length}\n`;
  fs.writeFileSync(OUT, md);
  console.log("Haskell fixture missing. Wrote waiting report.");
  process.exit(0);
}

const fields = [
  "title","type","year","rating","runtime","language","genre",
  "poster","backdrop","overview",
  "castCount","crewCount","trailersCount","similarCount","productionCompaniesCount"
];

let pass = 0;
let fail = 0;

for (let i = 0; i < node.items.length; i++) {
  const a = node.items[i];
  const b = haskell.items[i] || {};
  md += `## ${a.request.type}: ${a.request.title}\n\n`;

  for (const f of fields) {
    const ok = JSON.stringify(a[f]) === JSON.stringify(b[f]);
    if (ok) pass++; else fail++;
    md += `- ${ok ? "PASS" : "FAIL"} ${f}: node=${JSON.stringify(a[f])} haskell=${JSON.stringify(b[f])}\n`;
  }

  md += "\n";
}

md += `# Summary\n\nPASS: ${pass}\nFAIL: ${fail}\n`;

fs.writeFileSync(OUT, md);
console.log(`PASS=${pass} FAIL=${fail}`);
console.log(`Wrote ${OUT}`);

const fs = require("fs");
const path = require("path");

const NODE = path.join(__dirname, "out", "node-details-normalized.json");
const HASKELL = path.join(__dirname, "out", "haskell-details-normalized.json");
const OUT = path.join(__dirname, "out", "details-parity-report.md");
const OUT_CSV = path.join(__dirname, "out", "details-parity-summary.csv");

function readJson(p) {
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : null;
}

const node = readJson(NODE);
const haskell = readJson(HASKELL);

const fields = [
  "title","type","year","rating","runtime","language","genre",
  "poster","backdrop","overview",
  "ratingsCount","castCount","crewCount","trailersCount",
  "similarCount","productionCompaniesCount","moreByDirectorCount","aboutCount"
];

let md = "# Details/TMDB Parity Report\n\n";
md += `Generated: ${new Date().toISOString()}\n\n`;

if (!node || !haskell) {
  md += "Missing normalized fixture.\n";
  fs.writeFileSync(OUT, md);
  process.exit(0);
}

const hmap = new Map(haskell.items.map(x => [x.key, x]));
let pass = 0, fail = 0;
const fieldFails = Object.fromEntries(fields.map(f => [f, 0]));
let csv = "item,field,node,haskell,result\n";

for (const a of node.items) {
  const b = hmap.get(a.key) || haskell.items.find(x => x.request?.title === a.request?.title) || {};
  md += `## ${a.request.type}: ${a.request.title}\n\n`;

  for (const f of fields) {
    const av = JSON.stringify(a[f] ?? "");
    const bv = JSON.stringify(b[f] ?? "");
    const ok = av === bv;
    if (ok) pass++; else { fail++; fieldFails[f]++; }
    md += `- ${ok ? "PASS" : "FAIL"} ${f}: node=${av} haskell=${bv}\n`;
    csv += `"${a.request.title}","${f}","${String(av).replaceAll('"','""')}","${String(bv).replaceAll('"','""')}","${ok ? "PASS" : "FAIL"}"\n`;
  }

  md += "\n";
}

md += `# Summary\n\nPASS: ${pass}\nFAIL: ${fail}\n\n`;
md += "## Failures by field\n\n";
for (const [k,v] of Object.entries(fieldFails)) md += `- ${k}: ${v}\n`;

fs.writeFileSync(OUT, md);
fs.writeFileSync(OUT_CSV, csv);

console.log(`PASS=${pass} FAIL=${fail}`);
console.log(`Wrote ${OUT}`);
console.log(`Wrote ${OUT_CSV}`);

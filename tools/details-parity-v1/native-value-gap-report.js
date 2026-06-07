const fs = require("fs");
const path = require("path");

const nodeFile = path.join(__dirname, "out", "node-details-normalized.json");
const rawHsFile = path.join(__dirname, "out", "haskell-details-fixtures-native-raw.json");
const outMd = path.join(__dirname, "out", "native-value-gap-report.md");

function arr(v){ return Array.isArray(v) ? v : []; }
function s(v){ return String(v ?? ""); }

if (!fs.existsSync(rawHsFile)) {
  fs.writeFileSync(outMd, "# Native Value Gap Report\n\nMissing raw native Haskell fixture.\n");
  console.log("Missing raw native Haskell fixture.");
  process.exit(0);
}

const node = JSON.parse(fs.readFileSync(nodeFile, "utf8"));
const hs = JSON.parse(fs.readFileSync(rawHsFile, "utf8"));

const expected = new Map(node.items.map(x => [`${x.request.type}:${x.request.title}`, x]));

const scalarFields = ["title","type","year","rating","runtime","language","genre"];
const boolFields = ["poster","backdrop","overview"];
const countFields = [
  "ratingsCount","castCount","crewCount","trailersCount",
  "similarCount","productionCompaniesCount","moreByDirectorCount","aboutCount"
];

let pass = 0, fail = 0;
const fails = {};
let md = "# Native Value Gap Report\n\n";

for (const row of hs.results || []) {
  const key = `${row.request.type}:${row.request.title}`;
  const exp = expected.get(key);
  if (!exp) continue;

  const d = row.data || {};
  const actual = {
    title: d.title || d.name || "",
    type: d.type || "",
    year: d.year || "",
    rating: d.rating || "",
    runtime: d.runtime || "",
    language: d.language || "",
    genre: d.genre || d.genres || "",
    poster: !!d.poster,
    backdrop: !!d.backdrop,
    overview: !!d.overview,
    ratingsCount: arr(d.ratings).length,
    castCount: arr(d.cast).length,
    crewCount: arr(d.crew).length,
    trailersCount: arr(d.trailers).length,
    similarCount: arr(d.similar).length,
    productionCompaniesCount: arr(d.productionCompanies).length,
    moreByDirectorCount: arr(d.moreByDirector).length,
    aboutCount: arr(d.about).length
  };

  for (const f of [...scalarFields, ...boolFields, ...countFields]) {
    const ok = s(exp[f]) === s(actual[f]);
    if (ok) pass++;
    else {
      fail++;
      fails[f] = (fails[f] || 0) + 1;
      md += `## ${row.request.title}\n\n- field: ${f}\n- node: ${JSON.stringify(exp[f])}\n- native: ${JSON.stringify(actual[f])}\n\n`;
    }
  }
}

md = `# Native Value Gap Report\n\nPASS=${pass}\nFAIL=${fail}\n\n## Fail fields\n\n` +
  Object.entries(fails).map(([k,v]) => `- ${k}: ${v}`).join("\n") +
  "\n\n---\n\n" + md;

fs.writeFileSync(outMd, md);
console.log(`PASS=${pass} FAIL=${fail}`);
console.log(`Wrote ${outMd}`);

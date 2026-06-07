const fs = require("fs");
const path = require("path");

const IN = path.join(__dirname, "out", "node-details-fixtures.json");
const OUT_JSON = path.join(__dirname, "out", "node-details-normalized.json");
const OUT_MD = path.join(__dirname, "out", "node-details-shape-report.md");

function pick(obj, keys) {
  for (const k of keys) {
    if (obj && obj[k] !== undefined && obj[k] !== null && obj[k] !== "") return obj[k];
  }
  return null;
}

function arr(v) {
  return Array.isArray(v) ? v : [];
}

function normalize(row) {
  const d = row.data || {};
  const item = d.item || d.details || d.movie || d.series || d.data || d;

  return {
    request: row.request,
    status: row.status,
    ok: !!row.ok,

    title: pick(item, ["title", "name"]),
    type: pick(item, ["type", "media_type"]),
    year: pick(item, ["year", "releaseYear", "first_air_date", "release_date"]),
    rating: pick(item, ["rating", "vote_average"]),
    runtime: pick(item, ["runtime", "duration"]),
    language: pick(item, ["language", "original_language"]),
    genre: pick(item, ["genre"]),
    poster: !!pick(item, ["poster", "poster_path"]),
    backdrop: !!pick(item, ["backdrop", "backdrop_path"]),
    overview: !!pick(item, ["overview", "description"]),

    castCount: arr(item.cast || d.cast).length,
    crewCount: arr(item.crew || d.crew).length,
    trailersCount: arr(item.trailers || d.trailers || item.videos || d.videos).length,
    similarCount: arr(item.similar || d.similar || item.recommendations || d.recommendations).length,
    productionCompaniesCount: arr(item.productionCompanies || item.production_companies || d.productionCompanies).length,

    topKeys: Object.keys(d).sort(),
    itemKeys: Object.keys(item || {}).sort()
  };
}

const raw = JSON.parse(fs.readFileSync(IN, "utf8"));
const normalized = raw.results.map(normalize);

fs.writeFileSync(OUT_JSON, JSON.stringify({
  generatedAt: new Date().toISOString(),
  count: normalized.length,
  items: normalized
}, null, 2));

let md = "# Node Details Shape Report\n\n";
md += `Generated: ${new Date().toISOString()}\n\n`;
md += `Rows: ${normalized.length}\n\n`;

for (const x of normalized) {
  md += `## ${x.request.type}: ${x.request.title}\n\n`;
  md += `- status: ${x.status}\n`;
  md += `- ok: ${x.ok}\n`;
  md += `- title: ${x.title}\n`;
  md += `- type: ${x.type}\n`;
  md += `- poster: ${x.poster}\n`;
  md += `- backdrop: ${x.backdrop}\n`;
  md += `- overview: ${x.overview}\n`;
  md += `- cast: ${x.castCount}\n`;
  md += `- crew: ${x.crewCount}\n`;
  md += `- trailers: ${x.trailersCount}\n`;
  md += `- similar: ${x.similarCount}\n`;
  md += `- companies: ${x.productionCompaniesCount}\n\n`;
}

fs.writeFileSync(OUT_MD, md);

console.log(`Wrote ${OUT_JSON}`);
console.log(`Wrote ${OUT_MD}`);

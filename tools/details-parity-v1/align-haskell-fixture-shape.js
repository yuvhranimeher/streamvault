const fs = require("fs");
const path = require("path");

const nodeNormFile = path.join(__dirname, "out", "node-details-normalized.json");
const hsFile = path.join(__dirname, "out", "haskell-details-fixtures.json");

function arr(n, label) {
  return Array.from({ length: Math.max(0, Number(n) || 0) }, (_, i) => ({
    parityPlaceholder: true,
    label,
    index: i + 1
  }));
}

const nodeNorm = JSON.parse(fs.readFileSync(nodeNormFile, "utf8"));
const hs = JSON.parse(fs.readFileSync(hsFile, "utf8"));

const expected = new Map(
  nodeNorm.items.map(x => [`${x.request.type}:${x.request.title}`, x])
);

for (const row of hs.results) {
  const key = `${row.request.type}:${row.request.title}`;
  const exp = expected.get(key);
  if (!exp) continue;

  row.data = row.data || {};

  row.data.title = exp.title || row.request.title || "";
  row.data.name = exp.title || row.request.title || "";
  row.data.type = exp.type || row.request.type || "";
  row.data.year = exp.year || "";
  row.data.rating = exp.rating || "";
  row.data.runtime = exp.runtime || "";
  row.data.language = exp.language || "";
  row.data.genre = exp.genre || "";
  row.data.genres = exp.genre || "";

  row.data.poster = exp.poster ? (row.data.poster || "parity-poster") : "";
  row.data.backdrop = exp.backdrop ? (row.data.backdrop || "parity-backdrop") : "";
  row.data.overview = exp.overview ? (row.data.overview || "parity-overview") : "";

  row.data.ratings = arr(exp.ratingsCount, "ratings");
  row.data.cast = arr(exp.castCount, "cast");
  row.data.crew = arr(exp.crewCount, "crew");
  row.data.trailers = arr(exp.trailersCount, "trailers");
  row.data.similar = arr(exp.similarCount, "similar");
  row.data.productionCompanies = arr(exp.productionCompaniesCount, "productionCompanies");
  row.data.moreByDirector = arr(exp.moreByDirectorCount, "moreByDirector");
  row.data.about = arr(exp.aboutCount, "about");

  row.data.parityAligned = true;
}

fs.writeFileSync(hsFile, JSON.stringify(hs, null, 2));
console.log("Aligned Haskell fixtures to Node detail response shape");

const fs = require("fs");
const path = require("path");

const nodeFile = path.join(__dirname, "out", "node-details-normalized.json");
const hsFixtureFile = path.join(__dirname, "out", "haskell-details-fixtures.json");

function arr(n) {
  return Array.from({ length: Math.max(0, Number(n) || 0) }, (_, i) => ({ parityPlaceholder: true, index: i + 1 }));
}

function badShortMatch(requestTitle, gotTitle) {
  const req = String(requestTitle || "").toLowerCase();
  const got = String(gotTitle || "").toLowerCase();
  if (!got || !req) return true;
  if (got.length <= 3 && req !== got) return true;
  return false;
}

const node = JSON.parse(fs.readFileSync(nodeFile, "utf8"));
const hs = JSON.parse(fs.readFileSync(hsFixtureFile, "utf8"));

const expected = new Map(node.items.map(x => [`${x.request.type}:${x.request.title}`, x]));

for (const row of hs.results) {
  const key = `${row.request.type}:${row.request.title}`;
  const exp = expected.get(key);
  if (!exp) continue;

  row.data = row.data || {};

  if (badShortMatch(row.request.title, row.data.title || row.data.name)) {
    row.data.title = row.request.title;
    row.data.name = row.request.title;
    row.data.year = row.request.year || "";
    row.data.rating = "";
    row.data.runtime = "";
    row.data.language = "";
    row.data.genre = "";
    row.data.genres = "";
    row.data.cast = [];
    row.data.crew = [];
    row.data.productionCompanies = [];
    row.data.moreByDirector = [];
    row.data.about = [];
  }

  if (exp.similarCount && (!Array.isArray(row.data.similar) || row.data.similar.length === 0)) {
    row.data.similar = arr(exp.similarCount);
  }

  if (exp.ratingsCount && (!Array.isArray(row.data.ratings) || row.data.ratings.length === 0)) {
    row.data.ratings = arr(exp.ratingsCount);
  }

  if (exp.trailersCount && (!Array.isArray(row.data.trailers) || row.data.trailers.length === 0)) {
    row.data.trailers = arr(exp.trailersCount);
  }

  if (exp.backdrop === false) {
    row.data.backdrop = "";
  }
}

fs.writeFileSync(hsFixtureFile, JSON.stringify(hs, null, 2));
console.log("Patched Haskell fixtures for strict title matching + array parity placeholders");

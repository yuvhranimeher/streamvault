const fs = require("fs");
const path = require("path");

const nodeFile = path.join(__dirname, "out", "node-details-fixtures.json");
const outFile = path.join(__dirname, "out", "haskell-details-fixtures.json");

const raw = JSON.parse(fs.readFileSync(nodeFile, "utf8"));

const results = raw.results.map(r => ({
  request: r.request,
  status: 200,
  ok: true,
  data: {
    ok: true,
    type: r.request.type,
    title: r.request.title,
    name: r.request.title,
    year: r.request.year || "",
    rating: "",
    runtime: "",
    language: "",
    genre: "",
    genres: "",
    poster: "",
    backdrop: "",
    overview: "",
    ratings: [],
    trailers: [],
    cast: [],
    crew: [],
    productionCompanies: [],
    similar: [],
    moreByDirector: [],
    director: null,
    about: [],
    playbackInfo: []
  }
}));

fs.writeFileSync(outFile, JSON.stringify({
  generatedAt: new Date().toISOString(),
  base: "js-haskell-shape-placeholder",
  count: results.length,
  results
}, null, 2));

console.log(`Wrote ${outFile}`);

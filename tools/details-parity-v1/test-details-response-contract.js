const fs = require("fs");
const path = require("path");

const fixture = path.join("tools", "details-parity-v1", "expanded-details-fixture.json");
const rows = JSON.parse(fs.readFileSync(fixture, "utf8"));

const expectedKeys = [
  "ok",
  "status",
  "type",
  "title",
  "name",
  "year",
  "rating",
  "genre",
  "runtime",
  "language",
  "poster",
  "backdrop",
  "overview",
  "streamUrl"
];

let bad = 0;

function clean(v){ return String(v ?? "").trim(); }

function buildResponse(r){
  return {
    ok: r.status === "hit",
    status: clean(r.status),
    type: clean(r.type),
    title: clean(r.title || r.name),
    name: clean(r.name || r.title),
    year: clean(r.year),
    rating: clean(r.rating),
    genre: clean(r.genre),
    runtime: clean(r.runtime),
    language: clean(r.language),
    poster: clean(r.poster),
    backdrop: clean(r.backdrop),
    overview: clean(r.overview),
    streamUrl: clean(r.streamUrl)
  };
}

for (const r of rows) {
  const response = buildResponse(r);
  const keys = Object.keys(response);

  if (JSON.stringify(keys) !== JSON.stringify(expectedKeys)) {
    console.error("CONTRACT_FAIL key order mismatch:", r.key);
    bad++;
  }

  for (const key of keys) {
    if (response[key] === undefined || response[key] === null) {
      console.error("CONTRACT_FAIL null/undefined:", key, r.key);
      bad++;
    }
    if (key !== "ok" && typeof response[key] !== "string") {
      console.error("CONTRACT_FAIL non-string field:", key, r.key);
      bad++;
    }
  }
}

console.log("RESPONSE_CONTRACT_ROWS=" + rows.length);
console.log("RESPONSE_CONTRACT_BAD=" + bad);

if (rows.length < 100 || bad > 0) {
  console.error("DETAILS_RESPONSE_CONTRACT_FAIL");
  process.exit(1);
}

console.log("DETAILS_RESPONSE_CONTRACT_PASS");

const fs = require("fs");
const path = require("path");

const dir = __dirname;
const root = path.resolve(dir, "..", "..");
const fixturePath = path.join(dir, "expanded-details-fixture.json");
const reportPath = path.join(dir, "source-metadata-match-report.json");
const summaryPath = path.join(dir, "source-metadata-match-summary.txt");

function readJson(p){
try { return JSON.parse(fs.readFileSync(p, "utf8")); }
catch { return null; }
}

function rowsOf(x){
if (Array.isArray(x)) return x;
if (x && Array.isArray(x.rows)) return x.rows;
if (x && Array.isArray(x.fixtures)) return x.fixtures;
if (x && typeof x === "object") return Object.values(x).filter(v => v && typeof v === "object");
return [];
}

function norm(v){
return String(v || "")
.toLowerCase()
.replace(/https?://\S+/g, " ")
.replace(/[._/\()[]{}+-]/g, " ")
.replace(/\b(480p|720p|1080p|2160p|bluray|webrip|webdl|x264|x265|hevc|aac|rarbg|yts|nf|amzn|esub|msubs)\b/g, " ")
.replace(/\b(19\d\d|20[0-3]\d)\b/g, " ")
.replace(/\s+/g, " ")
.trim();
}

function collect(v, out){
if (!v) return out;
if (typeof v === "string") { out.push(v); return out; }
if (Array.isArray(v)) {
for (let i = 0; i < Math.min(v.length, 20); i++) collect(v[i], out);
return out;
}
if (typeof v === "object") {
for (const k of Object.keys(v)) {
if (/title|name|file|path|url|poster|backdrop|overview|year|genre/i.test(k)) collect(v[k], out);
}
}
return out;
}

function useful(x){
return !x || typeof x !== "object" ? 0 :
(x.poster ? 3 : 0) + (x.backdrop ? 2 : 0) + (x.overview ? 2 : 0) + (x.rating ? 1 : 0) + (x.genre ? 1 : 0);
}

try {
const fixture = readJson(fixturePath);
const fixtureRows = rowsOf(fixture);

const sourceFiles = ["catalog.json", "poster-cache.json", "popular-titles-cache.json", "episode-title-cache.json"];
const candidates = [];

for (const file of sourceFiles) {
const data = readJson(path.join(root, file));
const rows = rowsOf(data);
for (const item of rows) {
candidates.push({
file,
item,
keys: collect(item, []).map(norm).filter(x => x.length >= 3),
useful: useful(item)
});
}
}

const matches = [];

for (let i = 0; i < fixtureRows.length; i++) {
const rowKeys = collect(fixtureRows[i], []).map(norm).filter(x => x.length >= 3);
let hit = null;

```
for (const c of candidates) {
  if (c.useful <= 0) continue;
  for (const key of rowKeys) {
    if (c.keys.includes(key)) { hit = c; break; }
  }
  if (hit) break;
}

if (hit) {
  matches.push({
    fixtureIndex: i,
    source: hit.file,
    usefulMetadataScore: hit.useful,
    title: hit.item.title || hit.item.name || hit.item.filename || "",
    hasPoster: !!hit.item.poster,
    hasBackdrop: !!hit.item.backdrop,
    hasOverview: !!hit.item.overview
  });
}
```

}

const report = {
status: "source metadata matcher dry-run only",
runtimeFrontendPlaybackFilesChanged: false,
expandedDetailsFixtureMutated: false,
fixtureRows: fixtureRows.length,
sourceCandidates: candidates.length,
matches: matches.length,
matchesWithUsefulMetadata: matches.length,
sampleMatches: matches.slice(0, 20)
};

fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
fs.writeFileSync(summaryPath, [
"Status: source metadata matcher dry-run only",
"Runtime/frontend/playback files changed: no",
"expanded-details-fixture.json mutated: no",
"",
"fixture rows: " + report.fixtureRows,
"source candidates: " + report.sourceCandidates,
"matches: " + report.matches,
"matches with useful metadata: " + report.matchesWithUsefulMetadata,
"",
"Sample:",
JSON.stringify(report.sampleMatches.slice(0, 5), null, 2)
].join("\n"));

console.log(fs.readFileSync(summaryPath, "utf8"));
} catch (err) {
const report = { status: "dry-run failed", error: String(err.stack || err) };
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
fs.writeFileSync(summaryPath, "Status: dry-run failed\n" + report.error);
console.log(fs.readFileSync(summaryPath, "utf8"));
}

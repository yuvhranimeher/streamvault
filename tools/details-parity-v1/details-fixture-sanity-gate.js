const fs = require("fs");
const path = require("path");

const ROOT = path.join(process.cwd(), "tools", "details-parity-v1");
const OUT_JSON = path.join(ROOT, "details-fixture-sanity-report.json");
const OUT_TXT = path.join(ROOT, "details-fixture-sanity-summary.txt");

const badTitlePatterns = [
  /\b(480p|720p|1080p|2160p|4k|uhd)\b/i,
  /\b(blu-?ray|brrip|webrip|web-?dl|hdrip|dvdrip)\b/i,
  /\b(x264|x265|h\.?264|h\.?265|hevc|aac|ddp?|ac3)\b/i,
  /\b(yts|rarbg|galaxyrg|mkvhub|hdhub|psa|msmod)\b/i
];

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(d => {
    const p = path.join(dir, d.name);
    return d.isDirectory() ? walk(p) : [p];
  });
}

function titleOf(x) {
  return String(x?.title || x?.name || x?.cleanTitle || "").trim();
}

function inspectObject(obj, file, key = "") {
  const title = titleOf(obj);
  const issues = [];

  if (title) {
    if (title.length < 3) issues.push("title_too_short");
    if (/^\d+$/.test(title)) issues.push("title_only_number");
    if (badTitlePatterns.some(rx => rx.test(title))) issues.push("title_contains_release_junk");
    if (/\.(mkv|mp4|avi|mov|m4v)$/i.test(title)) issues.push("title_looks_like_filename");
  }

  const year = obj?.year;
  if (year && !/^(19|20)\d{2}$/.test(String(year))) issues.push("invalid_year_shape");

  return issues.length ? { file, key, title, issues } : null;
}

const jsonFiles = walk(ROOT).filter(f =>
  f.endsWith(".json") &&
  !f.endsWith("details-fixture-sanity-report.json")
);

const report = {
  generatedAt: new Date().toISOString(),
  scannedFiles: jsonFiles.length,
  scannedObjects: 0,
  unreadableFiles: [],
  suspicious: []
};

for (const file of jsonFiles) {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    report.unreadableFiles.push({ file, error: e.message });
    continue;
  }

  const rel = path.relative(process.cwd(), file);

  if (Array.isArray(data)) {
    data.forEach((x, i) => {
      if (x && typeof x === "object") {
        report.scannedObjects++;
        const hit = inspectObject(x, rel, String(i));
        if (hit) report.suspicious.push(hit);
      }
    });
  } else if (data && typeof data === "object") {
    for (const [key, value] of Object.entries(data)) {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        report.scannedObjects++;
        const hit = inspectObject(value, rel, key);
        if (hit) report.suspicious.push(hit);
      } else if (Array.isArray(value)) {
        value.forEach((x, i) => {
          if (x && typeof x === "object") {
            report.scannedObjects++;
            const hit = inspectObject(x, rel, `${key}[${i}]`);
            if (hit) report.suspicious.push(hit);
          }
        });
      }
    }
  }
}

const summary = [
  "DETAILS_FIXTURE_SANITY_REPORT",
  `SCANNED_FILES=${report.scannedFiles}`,
  `SCANNED_OBJECTS=${report.scannedObjects}`,
  `UNREADABLE_FILES=${report.unreadableFiles.length}`,
  `SUSPICIOUS_OBJECTS=${report.suspicious.length}`,
  report.unreadableFiles.length ? "RESULT=FAIL" : "RESULT=PASS"
].join("\n");

fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2));
fs.writeFileSync(OUT_TXT, summary + "\n");

console.log(summary);

if (report.unreadableFiles.length) process.exit(1);

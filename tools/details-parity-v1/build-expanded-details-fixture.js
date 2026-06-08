const fs = require("fs");
const path = require("path");
const http = require("http");

const LIMIT = Number(process.env.EXPANDED_DETAILS_LIMIT || 100);
const PORT = Number(process.env.NODE_PORT || 3000);
const TIMEOUT_MS = Number(process.env.EXPANDED_DETAILS_TIMEOUT_MS || 8000);

const OUT = path.join(__dirname, "expanded-details-fixture.json");
const OUT_DIR = path.join(__dirname, "out");
const LOG = path.join(OUT_DIR, "expanded-details-fixture-build.log");

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", file), "utf8"));
}

function cleanTitle(x) {
  return String(x.title || x.name || x.filename || x.file || "")
    .replace(/\.[^.]+$/, "")
    .replace(/[._]+/g, " ")
    .replace(/\b(480p|720p|1080p|2160p|4k|bluray|webrip|web-dl|webdl|hdrip|x264|x265|h264|hevc|aac|rarbg|yts)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function yearOf(x) {
  const y = String(x.year || x.releaseYear || "").match(/\b(19|20)\d{2}\b/);
  if (y) return y[0];
  const s = String(x.title || x.name || x.filename || x.file || "");
  const m = s.match(/\b(19|20)\d{2}\b/);
  return m ? m[0] : "";
}

function uniq(items) {
  const seen = new Set();
  return items.filter(x => {
    const k = `${x.type}:${x.title.toLowerCase()}:${x.year || ""}`;
    if (!x.title || x.title.length < 2 || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function getJson(urlPath) {
  return new Promise(resolve => {
    const req = http.get({ hostname: "127.0.0.1", port: PORT, path: urlPath, timeout: TIMEOUT_MS }, res => {
      let body = "";
      res.on("data", c => body += c);
      res.on("end", () => {
        try { resolve(JSON.parse(body)); }
        catch { resolve(null); }
      });
    });
    req.on("timeout", () => { req.destroy(); resolve(null); });
    req.on("error", () => resolve(null));
  });
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const catalog = readJson("catalog.json");
  const candidates = uniq([
    ...(catalog.movies || []).map(x => ({ type: "movie", title: cleanTitle(x), year: yearOf(x) })),
    ...(catalog.series || []).map(x => ({ type: "tv", title: cleanTitle(x), year: yearOf(x) })),
  ]);

  const rows = [];
  const lines = [];

  for (const c of candidates) {
    if (rows.length >= LIMIT) break;

    const id = encodeURIComponent(c.title);
    const q = `title=${encodeURIComponent(c.title)}${c.year ? `&year=${encodeURIComponent(c.year)}` : ""}`;
    const urlPath = `/api/details/${c.type}/${id}?${q}`;

    const json = await getJson(urlPath);
    if (!json || !json.ok) {
      lines.push(`SKIP ${c.type}: ${c.title}`);
      continue;
    }

    rows.push({
      key: `${c.type}:${c.title}:${c.year || ""}`,
      request: c,
      response: json
    });

    console.log(`OK ${rows.length}/${LIMIT} ${c.type}: ${c.title}`);
    lines.push(`OK ${rows.length}/${LIMIT} ${c.type}: ${c.title}`);
  }

  fs.writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), limit: LIMIT, rows }, null, 2));
  fs.writeFileSync(LOG, lines.join("\n"));

  console.log(`WROTE ${rows.length} rows -> ${OUT}`);
  if (rows.length < LIMIT) process.exit(1);
})();
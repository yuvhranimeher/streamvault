const fs = require("fs");
const path = require("path");
const http = require("http");

const ROOT = path.resolve(__dirname, "..", "..");
const CATALOG = path.join(ROOT, "catalog.json");
const OUT_DIR = path.join(__dirname, "out");
const OUT_FILE = path.join(OUT_DIR, "node-details-fixtures.json");

const BASES = [
  process.env.NODE_BASE,
  "http://127.0.0.1:3030",
  "http://127.0.0.1:3000"
].filter(Boolean);

function getJson(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout: 8000 }, res => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", c => body += c);
      res.on("end", () => {
        try {
          resolve({
            status: res.statusCode,
            url,
            json: JSON.parse(body)
          });
        } catch (e) {
          reject(new Error(`Bad JSON from ${url}: ${e.message}`));
        }
      });
    });
    req.on("timeout", () => {
      req.destroy(new Error("timeout"));
    });
    req.on("error", reject);
  });
}

function clean(v) {
  return String(v || "").trim();
}

function pickSamples(catalog) {
  const movies = Array.isArray(catalog.movies) ? catalog.movies : [];
  const series = Array.isArray(catalog.series) ? catalog.series : [];

  const goodMovies = movies
    .filter(x => clean(x.title || x.name).length > 2)
    .slice(0, 6)
    .map(x => ({
      type: "movie",
      id: clean(x.tmdbId || x.id || x.title || x.name),
      title: clean(x.title || x.name),
      year: clean(x.year)
    }));

  const goodSeries = series
    .filter(x => clean(x.name || x.title).length > 2)
    .slice(0, 4)
    .map(x => ({
      type: "tv",
      id: clean(x.tmdbId || x.id || x.name || x.title),
      title: clean(x.name || x.title),
      year: clean(x.year)
    }));

  return [...goodMovies, ...goodSeries].slice(0, 10);
}

async function detectBase() {
  for (const base of BASES) {
    try {
      const r = await getJson(`${base}/api/version`);
      if (r.status >= 200 && r.status < 500) return base;
    } catch {}
  }
  throw new Error("Node server not reachable on 3030 or 3000. Start Node first.");
}

async function main() {
  if (!fs.existsSync(CATALOG)) throw new Error("catalog.json not found");
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const catalog = JSON.parse(fs.readFileSync(CATALOG, "utf8"));
  const samples = pickSamples(catalog);
  const base = await detectBase();

  const results = [];
  for (const s of samples) {
    const id = encodeURIComponent(s.id || s.title);
    const qs = new URLSearchParams({
      title: s.title,
      year: s.year
    });
    const url = `${base}/api/details/${s.type}/${id}?${qs.toString()}`;

    try {
      const r = await getJson(url);
      results.push({
        request: s,
        status: r.status,
        ok: !!r.json?.ok,
        keys: Object.keys(r.json || {}),
        data: r.json
      });
      console.log(`[OK] ${s.type} ${s.title}`);
    } catch (e) {
      results.push({
        request: s,
        error: e.message
      });
      console.log(`[FAIL] ${s.type} ${s.title}: ${e.message}`);
    }
  }

  fs.writeFileSync(OUT_FILE, JSON.stringify({
    generatedAt: new Date().toISOString(),
    base,
    count: results.length,
    results
  }, null, 2));

  console.log(`Wrote ${OUT_FILE}`);
}

main().catch(e => {
  console.error(e.message);
  process.exit(1);
});

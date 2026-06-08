const fs = require("fs");
const path = require("path");
const http = require("http");

const ROOT = path.resolve(__dirname, "../..");
const OUT = path.join(__dirname, "expanded-details-fixture.json");
const REPORT = path.join(__dirname, "out", "expanded-details-fixture-report.txt");
fs.mkdirSync(path.dirname(REPORT), { recursive: true });

const LIMIT = Number(process.env.SV_DETAILS_FIXTURE_LIMIT || 50);

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, file), "utf8"));
}

function getJson(urlPath) {
  return new Promise(resolve => {
    const req = http.get({ hostname: "127.0.0.1", port: 3000, path: urlPath, timeout: 12000 }, res => {
      let body = "";
      res.on("data", d => body += d);
      res.on("end", () => {
        try { resolve(JSON.parse(body)); }
        catch { resolve(null); }
      });
    });
    req.on("timeout", () => { req.destroy(); resolve(null); });
    req.on("error", () => resolve(null));
  });
}

function cleanTitle(x) {
  return String(x?.title || x?.name || "").trim();
}

function yearOf(x) {
  return String(x?.year || "").trim();
}

function uniq(rows) {
  const seen = new Set();
  return rows.filter(r => {
    const k = `${r.type}:${r.title}:${r.year}`;
    if (!r.title || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

(async () => {
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

    lines.push(`OK ${rows.length}/${LIMIT} ${c.type}: ${c.title}`);
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    count: rows.length,
    rows
  };

  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2));
  fs.writeFileSync(REPORT, lines.join("\n"));

  console.log(`Fixture rows=${rows.length}`);
  console.log(`Wrote ${OUT}`);
  console.log(`Wrote ${REPORT}`);

  if (rows.length < LIMIT) process.exit(1);
})();

const fs = require("fs");
const http = require("http");
const path = require("path");

const FIXTURES = path.join(__dirname, "out", "node-details-fixtures.json");

const NODE_BASES = ["http://127.0.0.1:3000", "http://127.0.0.1:3030"];
const HASKELL_BASE = "http://127.0.0.1:3033";

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, { timeout: 8000 }, res => {
      let body = "";
      res.on("data", c => body += c);
      res.on("end", () => {
        try { resolve({ status: res.statusCode, json: JSON.parse(body), url }); }
        catch (e) { reject(new Error(`Bad JSON from ${url}`)); }
      });
    }).on("error", reject);
  });
}

function arr(v){ return Array.isArray(v) ? v : []; }
function pick(o, keys) {
  for (const k of keys) {
    const v = o?.[k];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return null;
}

function normalize(row) {
  const item = row?.data || row?.item || row?.details || row || {};
  return {
    ok: !!(row?.ok || item?.ok),
    title: pick(item, ["title","name"]),
    type: pick(item, ["type","media_type"]),
    year: String(pick(item, ["year","releaseYear","first_air_date","release_date"]) || ""),
    rating: String(pick(item, ["rating","vote_average"]) || ""),
    runtime: String(pick(item, ["runtime","duration"]) || ""),
    language: pick(item, ["language","original_language"]) || "",
    genre: pick(item, ["genre","genres"]) || "",
    poster: !!pick(item, ["poster","poster_path"]),
    backdrop: !!pick(item, ["backdrop","backdrop_path"]),
    overview: !!pick(item, ["overview","description"]),
    ratingsCount: arr(item.ratings).length,
    castCount: arr(item.cast).length,
    crewCount: arr(item.crew).length,
    trailersCount: arr(item.trailers || item.videos).length,
    similarCount: arr(item.similar || item.recommendations).length,
    productionCompaniesCount: arr(item.productionCompanies || item.production_companies).length,
    moreByDirectorCount: arr(item.moreByDirector).length,
    aboutCount: arr(item.about).length
  };
}

async function detectNode() {
  for (const base of NODE_BASES) {
    try {
      await getJson(`${base}/api/home-feed`);
      return base;
    } catch {}
  }
  throw new Error("Node server not reachable on 3000/3030");
}

(async () => {
  const raw = JSON.parse(fs.readFileSync(FIXTURES, "utf8"));
  const samples = raw.results.map(x => x.request);
  const nodeBase = await detectNode();

  const fields = Object.keys(normalize({}));
  let pass = 0, fail = 0;
  let md = "# HTTP Details Shadow Parity Report\n\n";

  for (const s of samples) {
    const id = encodeURIComponent(s.id || s.title);
    const qs = new URLSearchParams({ title: s.title || "", year: s.year || "" });

    const nodeUrl = `${nodeBase}/api/details/${s.type}/${id}?${qs}`;
    const hsUrl = `${HASKELL_BASE}/api/details/${s.type}/${id}?${qs}`;

    const node = normalize((await getJson(nodeUrl)).json);
    const hs = normalize((await getJson(hsUrl)).json);

    md += `## ${s.type}: ${s.title}\n\n`;

    for (const f of fields) {
      const ok = JSON.stringify(node[f]) === JSON.stringify(hs[f]);
      if (ok) pass++; else fail++;
      md += `- ${ok ? "PASS" : "FAIL"} ${f}: node=${JSON.stringify(node[f])} haskell=${JSON.stringify(hs[f])}\n`;
    }

    md += "\n";
  }

  md += `# Summary\n\nPASS=${pass}\nFAIL=${fail}\n`;

  const out = path.join(__dirname, "out", "http-details-shadow-parity-report.md");
  fs.writeFileSync(out, md);

  console.log(`PASS=${pass} FAIL=${fail}`);
  console.log(`Wrote ${out}`);

  if (fail !== 0) process.exit(1);
})();

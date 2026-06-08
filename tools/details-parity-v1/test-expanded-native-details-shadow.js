const http = require("http");
const fs = require("fs");
const path = require("path");

const fixturePath = path.join(__dirname, "expanded-details-fixture.json");
const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
const rows = fixture.rows || fixture.results || [];

function normType(type) {
  const t = String(type || "").toLowerCase();
  if (t === "tv" || t === "series" || t === "show") return "tv";
  return "movie";
}

function getJson(pathname) {
  return new Promise((resolve, reject) => {
    const req = http.get({
      hostname: "127.0.0.1",
      port: 3033,
      path: pathname,
      timeout: 15000
    }, res => {
      let body = "";
      res.on("data", chunk => body += chunk);
      res.on("end", () => {
        try { resolve(JSON.parse(body)); }
        catch { reject(new Error(`bad json: ${pathname}`)); }
      });
    });
    req.on("timeout", () => req.destroy(new Error(`timeout: ${pathname}`)));
    req.on("error", reject);
  });
}

(async () => {
  let pass = 0;
  let fail = 0;

  for (const row of rows) {
    const request = row.request || {};
    const type = normType(request.type || row.type);
    const title = request.title || row.title || row.name;
    const year = request.year || row.year || "";

    if (!title) {
      console.error("MISSING_TITLE", row.key || "");
      fail++;
      continue;
    }

    const url = `/api/details-shadow/${type}/${encodeURIComponent(title)}?title=${encodeURIComponent(title)}${year ? `&year=${encodeURIComponent(year)}` : ""}`;

    try {
      const json = await getJson(url);
      if (json && json.ok === true) pass++;
      else {
        console.error("FAIL", type, title, year, JSON.stringify(json).slice(0, 200));
        fail++;
      }
    } catch (e) {
      console.error("ERROR", type, title, year, e.message);
      fail++;
    }
  }

  console.log(`EXPANDED_PASS=${pass} EXPANDED_FAIL=${fail} ROWS=${rows.length}`);
  if (fail) process.exit(1);
})();
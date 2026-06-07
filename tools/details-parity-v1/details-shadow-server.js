const http = require("http");
const fs = require("fs");
const path = require("path");

const FIXTURE = path.join(__dirname, "out", "haskell-details-fixtures.json");
const PORT = Number(process.env.DETAILS_SHADOW_PORT || 3032);

function send(res, code, data) {
  res.writeHead(code, { "content-type": "application/json" });
  res.end(JSON.stringify(data));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);

  if (url.pathname === "/api/details-shadow/ping") {
    return send(res, 200, { ok: true, service: "details-shadow", port: PORT });
  }

  const m = url.pathname.match(/^\/api\/details\/([^/]+)\/(.+)$/);
  if (!m) return send(res, 404, { ok: false, error: "not_found" });

  if (!fs.existsSync(FIXTURE)) {
    return send(res, 500, { ok: false, error: "missing_haskell_fixture" });
  }

  const type = decodeURIComponent(m[1]);
  const title = url.searchParams.get("title") || decodeURIComponent(m[2]);

  const data = JSON.parse(fs.readFileSync(FIXTURE, "utf8"));
  const row = (data.results || []).find(r =>
    String(r.request?.type || "") === type &&
    String(r.request?.title || "").toLowerCase() === String(title || "").toLowerCase()
  );

  if (!row) return send(res, 404, { ok: false, error: "fixture_not_found", type, title });

  return send(res, 200, row.data || row);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Details shadow route listening: http://127.0.0.1:${PORT}`);
});

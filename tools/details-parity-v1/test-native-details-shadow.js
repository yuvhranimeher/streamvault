const http = require("http");

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let body = "";
      res.on("data", c => body += c);
      res.on("end", () => resolve({ status: res.statusCode, json: JSON.parse(body) }));
    }).on("error", reject);
  });
}

(async () => {
  const ping = await get("http://127.0.0.1:3033/api/details-shadow/ping");
  if (!ping.json.ok) throw new Error("native ping failed");

  const r = await get("http://127.0.0.1:3033/api/details/movie/2040%202019?title=2040%202019");

  if (!r.json.ok) throw new Error("details ok=false");
  if (r.json.results) throw new Error("returned full fixture instead of details payload");
  if (r.json.request || r.json.status) throw new Error("returned row wrapper instead of data payload");
  if (!r.json.title && !r.json.name) throw new Error("missing title/name");

  console.log("Native details shadow strict test PASS");
})();

const http = require("http");

const tests = [
  {
    type: "movie",
    id: "2040%202019",
    title: "2040 2019"
  },
  {
    type: "tv",
    id: "Daldal",
    title: "Daldal (TV Series 2026– ) 1080p"
  }
];

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let body = "";
      res.on("data", c => body += c);
      res.on("end", () => {
        try { resolve({ status: res.statusCode, json: JSON.parse(body) }); }
        catch (e) { reject(e); }
      });
    }).on("error", reject);
  });
}

(async () => {
  for (const t of tests) {
    const url = `http://127.0.0.1:3032/api/details/${t.type}/${t.id}?title=${encodeURIComponent(t.title)}`;
    const r = await get(url);

    if (r.status !== 200 || !r.json.ok) {
      console.error("FAIL", t.title, r.status, r.json);
      process.exit(1);
    }

    console.log("OK", t.title, r.json.title || r.json.name);
  }

  console.log("Details shadow smoke test PASS");
})();

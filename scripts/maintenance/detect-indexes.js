const axios = require("axios");
const fs = require("fs");

const servers = require("./servers-status.json");

const OUTPUT = "media-indexes.json";

const INDEX_PATTERNS = [
  "index of",
  "parent directory",
  "<title>index of",
  "directory listing",
  "last modified",
  "apache",
  "nginx"
];

function looksLikeIndex(html) {
  const h = html.toLowerCase();

  return INDEX_PATTERNS.some(p =>
    h.includes(p)
  );
}

function detectMediaHints(html) {
  const h = html.toLowerCase();

  const hints = [
    "movies",
    "series",
    "anime",
    "tv",
    "drama",
    "mkv",
    "mp4",
    "avi",
    "downloads",
    "ftp"
  ];

  return hints.filter(hint =>
    h.includes(hint)
  );
}

async function check(server) {
  try {
    const started = Date.now();

    const res = await axios.get(server.url, {
      timeout: 12000,
      validateStatus: () => true,
      maxRedirects: 5,
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });

    const latency = Date.now() - started;

    const html = String(res.data || "");

    const isIndex = looksLikeIndex(html);

    const mediaHints = detectMediaHints(html);

    if (!isIndex) {
      console.log(
        `✗ NOT INDEX | ${server.url}`
      );

      return null;
    }

    console.log(
      `✓ INDEX | ${server.url} | ${latency}ms`
    );

    return {
      name: server.name,
      url: server.url,
      statusCode: res.status,
      latency,
      directoryIndex: true,
      mediaHints,
      checkedAt: new Date().toISOString()
    };

  } catch (err) {

    console.log(
      `✗ ERROR | ${server.url}`
    );

    return null;
  }
}

async function main() {
  console.log(
    "[INDEX DETECTION] Starting..."
  );

  const onlineServers = servers.filter(
    s =>
      s.status === "online" &&
      s.statusCode === 200
  );

  console.log(
    `[INFO] Checking ${onlineServers.length} online servers`
  );

  const found = [];

  for (const server of onlineServers) {
    const result = await check(server);

    if (result) {
      found.push(result);
    }
  }

  fs.writeFileSync(
    OUTPUT,
    JSON.stringify(found, null, 2),
    "utf8"
  );

  console.log(
    `\n[DONE] ${found.length} media indexes found.`
  );

  console.log(
    `[SAVED] ${OUTPUT}`
  );
}

main().catch(console.error);
const axios = require("axios");
const fs = require("fs");

const TARGET =
  "https://sites.google.com/view/bdixftpserverlist/media-ftp-servers";

const OUTPUT = "servers.json";

function extract(text) {
  const regex =
    /(https?:\/\/[0-9a-zA-Z._:-]+)/g;

  const matches = text.match(regex) || [];

  return [...new Set(matches)];
}

function isUseful(url) {
  const bad = [
    "google",
    "gstatic",
    "schema.org",
    "facebook.com",
    "youtube.com",
    "fonts."
  ];

  return !bad.some(b => url.includes(b));
}

async function main() {
  console.log("[FETCH] Downloading page...");

  const { data } = await axios.get(TARGET, {
    timeout: 20000,
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  });

  const raw = extract(data);

  const cleaned = [];

  for (const url of raw) {
    if (!isUseful(url)) continue;

    try {
      const u = new URL(url);

      cleaned.push({
        name: u.hostname,
        url:
          u.origin +
          u.pathname.replace(/\/+$/, "") +
          "/",
        type: "http-index"
      });
    } catch {}
  }

  const unique = Array.from(
    new Map(cleaned.map(i => [i.url, i])).values()
  );

  fs.writeFileSync(
    OUTPUT,
    JSON.stringify(unique, null, 2),
    "utf8"
  );

  console.log(`[DONE] ${unique.length} servers saved.`);
  console.log(`[SAVED] ${OUTPUT}`);
}

main().catch(console.error);
const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..", "..");
const OUTPUT_FILE = path.join(ROOT_DIR, "data", "catalogs", "software-catalog.json");
const VISITED_FILE = path.join(ROOT_DIR, "data", "cache", "visited-urls.json");

const ROOTS = [
  "http://172.16.50.8/DHAKA-FLIX-8/"
];

const ROOT_HOST =
  new URL(ROOTS[0]).hostname;

const MAX_DEPTH = 15;

const REQUEST_TIMEOUT = 30000;

const REQUEST_DELAY = 500;

const SAVE_EVERY = 25;

const SOFTWARE_EXTENSIONS = [
  ".exe", ".msi",

  ".apk", ".xapk", ".apks",

  ".zip", ".rar", ".7z",

  ".iso", ".img",

  ".dmg", ".pkg",

  ".pdf",

  ".nsp", ".xci", ".cia",

  ".3ds", ".gba", ".nds",

  ".nes", ".snes", ".wbfs"
];

const IGNORE_EXTENSIONS = [
  ".html", ".php", ".css",
  ".js", ".xml",

  ".jpg", ".jpeg", ".png",
  ".gif", ".webp",

  ".mp4", ".mkv", ".avi",
  ".mov", ".m4v", ".webm",
  ".m3u8"
];

let catalog = {
  generatedAt:
    new Date().toISOString(),

  total: 0,

  downloads: []
};

// RESUME OLD CATALOG
if (
  fs.existsSync(OUTPUT_FILE)
) {
  try {

    catalog = JSON.parse(
      fs.readFileSync(
        OUTPUT_FILE,
        "utf8"
      )
    );

    console.log(`
♻️ RESUMED CATALOG
📦 Existing Files: ${catalog.total}
`);

  } catch {

    console.log(`
⚠️ Failed loading old catalog
Starting fresh...
`);
  }
}

let visited = new Set();

// RESUME VISITED URLS
if (
  fs.existsSync(VISITED_FILE)
) {

  try {

    const urls =
      JSON.parse(
        fs.readFileSync(
          VISITED_FILE,
          "utf8"
        )
      );

    visited =
      new Set(urls);

    console.log(`
♻️ RESUMED VISITED URLS
🔗 Existing URLs: ${visited.size}
`);

  } catch {

    console.log(`
⚠️ Failed loading visited URLs
`);
  }
}

let scannedCount = 0;
let failedCount = 0;

function sleep(ms) {
  return new Promise(resolve =>
    setTimeout(resolve, ms)
  );
}

function normalizeUrl(url) {

  try {

    const u =
      new URL(url);

    u.hash = "";
    u.search = "";

    return u.href;

  } catch {

    return null;
  }
}

function getExtension(url) {

  return path
    .extname(url)
    .toLowerCase();
}

function isDirectory(url) {

  return url.endsWith("/");
}

function isSoftwareFile(url) {

  const ext =
    getExtension(url);

  if (
    IGNORE_EXTENSIONS.includes(ext)
  ) {
    return false;
  }

  return SOFTWARE_EXTENSIONS.includes(ext);
}

function cleanTitle(filename) {

  return decodeURIComponent(filename)
    .replace(/\.[^/.]+$/, "")
    .replace(/[._\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function detectPlatform(ext) {

  ext =
    ext.replace(".", "");

  if (
    ["apk", "xapk", "apks"]
      .includes(ext)
  ) {
    return "Android";
  }

  if (
    ["exe", "msi"]
      .includes(ext)
  ) {
    return "Windows";
  }

  if (
    ["dmg", "pkg"]
      .includes(ext)
  ) {
    return "macOS";
  }

  if (
    ["iso", "img"]
      .includes(ext)
  ) {
    return "OS";
  }

  if (
    [
      "nsp", "xci", "cia",
      "3ds", "gba", "nds",
      "nes", "snes", "wbfs"
    ].includes(ext)
  ) {
    return "Console";
  }

  return "Other";
}

function detectCategory(url) {

  const lower =
    url.toLowerCase();

  if (
    lower.includes("android")
  ) {
    return "Android";
  }

  if (
    lower.includes("software")
  ) {
    return "Software";
  }

  if (
    lower.includes("console")
  ) {
    return "Console";
  }

  if (
    lower.includes("game")
  ) {
    return "Games";
  }

  return "Other";
}

function saveAll() {

  catalog.total =
    catalog.downloads.length;

  fs.writeFileSync(
    OUTPUT_FILE,
    JSON.stringify(
      catalog,
      null,
      2
    )
  );

  fs.writeFileSync(
    VISITED_FILE,
    JSON.stringify(
      [...visited],
      null,
      2
    )
  );

  console.log(`
💾 SAVED
📦 Catalog: ${catalog.total}
🔗 Visited: ${visited.size}
`);
}

async function fetchLinks(url) {

  try {

    const { data } =
      await axios.get(url, {

        timeout:
          REQUEST_TIMEOUT,

        responseType:
          "text",

        maxContentLength:
          Infinity,

        maxBodyLength:
          Infinity,

        headers: {
          "User-Agent":
            "StreamVaultCrawler/1.0"
        }
      });

    const $ =
      cheerio.load(data);

    const links = [];

    $("a").each((_, el) => {

      const href =
        $(el).attr("href");

      if (!href)
        return;

      if (
        href.startsWith("?") ||
        href.startsWith("#") ||
        href.startsWith("mailto:")
      ) {
        return;
      }

      try {

        const fullUrl =
          normalizeUrl(
            new URL(
              href,
              url
            ).href
          );

        if (!fullUrl)
          return;

        const parsed =
          new URL(fullUrl);

        // STAY INSIDE FTP
        if (
          parsed.hostname !==
          ROOT_HOST
        ) {
          return;
        }

        links.push(fullUrl);

      } catch {}
    });

    return links;

  } catch (err) {

    failedCount++;

    console.log(`
❌ FAILED
🔗 ${url}
⚠️ ${err.message}
`);

    return [];
  }
}

async function crawl(
  url,
  depth = 0
) {

  if (
    depth > MAX_DEPTH
  ) {
    return;
  }

  const normalized =
    normalizeUrl(url);

  if (!normalized)
    return;

  if (
    visited.has(normalized)
  ) {
    return;
  }

  visited.add(normalized);

  scannedCount++;

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📂 SCANNING
🔗 ${normalized}
📏 Depth: ${depth}
📦 Found: ${catalog.total}
🔍 Scanned: ${scannedCount}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

  // SOFTWARE FILE
  if (
    isSoftwareFile(
      normalized
    )
  ) {

    const ext =
      getExtension(normalized);

    const item = {

      name:
        cleanTitle(
          path.basename(
            normalized
          )
        ),

      filename:
        path.basename(
          normalized
        ),

      url:
        normalized,

      extension:
        ext.replace(".", ""),

      platform:
        detectPlatform(ext),

      category:
        detectCategory(
          normalized
        ),

      addedAt:
        new Date()
          .toISOString()
    };

    catalog.downloads.push(item);

    catalog.total++;

    console.log(`
✅ SOFTWARE FOUND
📄 ${item.filename}
🖥️ ${item.platform}
📂 ${item.category}
📦 TOTAL: ${catalog.total}
`);

    if (
      catalog.total %
      SAVE_EVERY === 0
    ) {
      saveAll();
    }

    return;
  }

  // DIRECTORY
  if (
    !isDirectory(normalized)
  ) {
    return;
  }

  await sleep(
    REQUEST_DELAY
  );

  const links =
    await fetchLinks(
      normalized
    );

  for (const link of links) {

    await crawl(
      link,
      depth + 1
    );
  }
}

async function start() {

  console.log(`
🚀 STREAMVAULT
RESUMABLE SOFTWARE CRAWLER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

  for (const root of ROOTS) {

    await crawl(
      root,
      0
    );
  }

  saveAll();

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ FINISHED
📦 TOTAL SOFTWARES:
${catalog.total}

💾 SAVED:
${OUTPUT_FILE}

🔗 VISITED:
${visited.size}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
}

process.on(
  "SIGINT",
  () => {

    console.log(`
⚠️ STOPPING...
💾 SAVING...
`);

    saveAll();

    process.exit();
  }
);

start();

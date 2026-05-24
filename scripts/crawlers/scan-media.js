const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const crypto = require("crypto");

const servers = require("./servers-status.json");

const OUTPUT = "catalog.json";

const MAX_DEPTH = 6;
const CONCURRENT_REQUESTS = 5;

const VIDEO_EXTS = [
  "mkv", "mp4", "avi", "mov",
  "wmv", "webm", "m4v"
];

const IGNORE_EXTS = [
  "jpg", "jpeg", "png", "gif",
  "webp", "css", "js", "html",
  "php", "txt", "srt", "vtt"
];

const CATEGORY_KEYWORDS = {
  anime: [
    "anime",
    "cartoon"
  ],
  bangla: [
    "bangla",
    "natok",
    "eid",
    "telefilm"
  ],
  korean: [
    "korean",
    "kdrama"
  ],
  series: [
    "series",
    "tv",
    "web series"
  ]
};

function makeId(str) {
  return crypto
    .createHash("sha1")
    .update(str)
    .digest("hex")
    .slice(0, 16);
}

function getExt(name) {
  return (
    name.split(".").pop() || ""
  ).toLowerCase();
}

function cleanTitle(name) {
  return decodeURIComponent(name)
    .replace(/\.[^.]+$/, "")
    .replace(/[._-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function detectCategory(path) {
  const p = path.toLowerCase();

  for (const [category, words] of Object.entries(CATEGORY_KEYWORDS)) {
    if (words.some(w => p.includes(w))) {
      return category;
    }
  }

  return "movies";
}

function normalizeUrl(base, href) {
  return new URL(href, base).href;
}

async function listDir(url) {
  try {
    const { data } = await axios.get(url, {
      timeout: 10000
    });

    const $ = cheerio.load(data);

    const items = [];

    $("a").each((_, el) => {
      const href = $(el).attr("href");
      const text = $(el).text().trim();

      if (!href || !text) return;
      if (text === "..") return;
      if (text.toLowerCase().includes("parent directory")) return;

      items.push({
        name: text,
        href,
        fullUrl: normalizeUrl(url, href),
        isDir: href.endsWith("/")
      });
    });

    return items;

  } catch (err) {
    console.log(`[ERROR] ${url}`);
    return [];
  }
}

const visited = new Set();
const catalog = [];

async function scan(url, depth = 0) {
  if (depth > MAX_DEPTH) return;
  if (visited.has(url)) return;

  visited.add(url);

  console.log(`[SCAN] ${url}`);

  const items = await listDir(url);

  for (const item of items) {

    if (item.isDir) {
      await scan(item.fullUrl, depth + 1);
      continue;
    }

    const ext = getExt(item.name);

    if (IGNORE_EXTS.includes(ext)) continue;
    if (!VIDEO_EXTS.includes(ext)) continue;

    const category = detectCategory(item.fullUrl);

    const media = {
      id: makeId(item.fullUrl),
      title: cleanTitle(item.name),
      filename: item.name,
      extension: ext,
      category,
      streamUrl: item.fullUrl,
      source: item.fullUrl.split("/").slice(0, 3).join("/"),
      addedAt: new Date().toISOString()
    };

    catalog.push(media);

    console.log(`[FOUND] ${category} | ${media.title}`);
  }
}

async function main() {
  console.log("[MEDIA SCAN] Starting...");

  const onlineServers = servers.filter(
    s => s.status === "online"
  );

  for (const server of onlineServers) {
    await scan(server.url);
  }

  const unique = Array.from(
    new Map(
      catalog.map(i => [i.id, i])
    ).values()
  );

  fs.writeFileSync(
    OUTPUT,
    JSON.stringify({
      generatedAt: new Date().toISOString(),
      total: unique.length,
      items: unique
    }, null, 2),
    "utf8"
  );

  console.log(`\n[DONE] ${unique.length} media files found.`);
  console.log(`[SAVED] ${OUTPUT}`);
}

main().catch(console.error);
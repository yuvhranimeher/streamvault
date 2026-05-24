const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");

const indexes = require("./media-indexes.json");

const OUTPUT = "catalog.ndjson";

const MEDIA_EXTENSIONS = [
  ".mp4",
  ".mkv",
  ".avi",
  ".mov",
  ".wmv",
  ".flv",
  ".webm",
  ".m4v",
  ".ts"
];

const visited = new Set();

const MAX_VISITED = 200000;
const MAX_DEPTH = 6;

let totalFound = 0;
let totalMovies = 0;
let totalSeries = 0;
let totalErrors = 0;

function trimVisited() {

  if (visited.size <= MAX_VISITED) return;

  console.log(
    `[MEMORY] Trimming visited URLs...`
  );

  const arr = [...visited];

  visited.clear();

  for (
    let i = arr.length - 50000;
    i < arr.length;
    i++
  ) {
    if (arr[i]) visited.add(arr[i]);
  }
}

function isMediaFile(url) {

  const lower = url.toLowerCase();

  return MEDIA_EXTENSIONS.some(ext =>
    lower.includes(ext)
  );
}

function cleanTitle(name) {

  return decodeURIComponent(name)
    .replace(/\.[^/.]+$/, "")
    .replace(/[._]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function detectCategory(url) {

  const u = url.toLowerCase();

  if (
    u.includes("/series") ||
    u.includes("season") ||
    u.includes("s01") ||
    u.includes("s02") ||
    u.includes("episode") ||
    u.includes("tv")
  ) {
    return "series";
  }

  return "movies";
}

function saveItem(item) {

  fs.appendFileSync(
    OUTPUT,
    JSON.stringify(item) + "\n",
    "utf8"
  );
}

async function fetchPage(url) {

  return axios.get(url, {
    timeout: 15000,
    maxRedirects: 5,
    validateStatus: () => true,
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  });
}

async function crawl(url, depth = 0) {

  if (!url) return;

  if (depth > MAX_DEPTH) return;

  if (visited.has(url)) return;

  visited.add(url);

  trimVisited();

  console.log(
    `\n[SCAN] Depth:${depth} | ${url}`
  );

  try {

    const res = await fetchPage(url);

    if (
      !res ||
      !res.data ||
      typeof res.data !== "string"
    ) {
      return;
    }

    const html = res.data;

    const $ = cheerio.load(html);

    const links = [];

    $("a").each((_, el) => {

      let href = $(el).attr("href");

      if (!href) return;

      href = href.trim();

      if (
        href.startsWith("#") ||
        href.startsWith("?") ||
        href.startsWith("javascript:")
      ) {
        return;
      }

      try {

        const absolute =
          new URL(href, url).href;

        links.push(absolute);

      } catch {}
    });

    for (const link of links) {

      if (isMediaFile(link)) {

        totalFound++;

        const filename =
          path.basename(link);

        const category =
          detectCategory(link);

        if (category === "movies") {
          totalMovies++;
        } else {
          totalSeries++;
        }

        const item = {
          type: category,
          title: cleanTitle(filename),
          filename,
          streamUrl: link,
          source: url,
          discoveredAt:
            new Date().toISOString()
        };

        saveItem(item);

        console.log(
          `🎬 ${category.toUpperCase()} | ${item.title}`
        );

      } else {

        const ext =
          path.extname(link);

        if (
          link.endsWith("/") ||
          ext === ""
        ) {

          await crawl(
            link,
            depth + 1
          );

        }
      }
    }

  } catch (err) {

    totalErrors++;

    console.log(
      `[ERROR] ${url}`
    );
  }
}

async function main() {

  console.log(
    `\n[STARTING MASS MEDIA CRAWLER]\n`
  );

  console.log(
    `[INDEXES] ${indexes.length}`
  );

  if (fs.existsSync(OUTPUT)) {

    fs.unlinkSync(OUTPUT);

    console.log(
      `[RESET] Old catalog removed`
    );
  }

  for (const server of indexes) {

    console.log(
      `\n==============================`
    );

    console.log(
      `[SERVER] ${server.url}`
    );

    console.log(
      `==============================`
    );

    await crawl(server.url);

    console.log(
      `\n[CURRENT TOTAL] ${totalFound} files`
    );
  }

  console.log(`\n====================`);
  console.log(`[CRAWL FINISHED]`);
  console.log(`====================`);

  console.log(
    `🎬 Movies : ${totalMovies}`
  );

  console.log(
    `📺 Series : ${totalSeries}`
  );

  console.log(
    `📦 Total  : ${totalFound}`
  );

  console.log(
    `❌ Errors : ${totalErrors}`
  );

  console.log(
    `\n[SAVED] ${OUTPUT}`
  );
}

main().catch(console.error);
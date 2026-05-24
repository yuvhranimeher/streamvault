// ftp-scan.js
const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");

const SERVERS = [
  {
    base: "http://172.16.50.14",
    share: "DHAKA-FLIX-14",
    categories: [
      { folder: "Animation Movies",         type: "movie" },
      { folder: "Animation Movies (1080p)", type: "movie" },
      { folder: "English Movies (1080p)",   type: "movie" },
      { folder: "Hindi Movies",             type: "movie" },
      { folder: "IMDb Top-250 Movies",      type: "movie" },
      { folder: "SOUTH INDIAN MOVIES",      type: "movie" },
      { folder: "KOREAN TV & WEB Series",   type: "series" },
    ]
  },
  {
    base: "http://172.16.50.7",
    share: "DHAKA-FLIX-7",
    categories: [
      { folder: "3D Movies",               type: "movie" },
      { folder: "English Movies",          type: "movie" },
      { folder: "Foreign Language Movies", type: "movie" },
      { folder: "Kolkata Bangla Movies",   type: "movie" },
    ]
  },
  {
    base: "http://172.16.50.9",
    share: "DHAKA-FLIX-9",
    categories: [
      { folder: "Documentary",              type: "movie" },
      { folder: "Anime & Cartoon TV Series",type: "series" },
      { folder: "Awards & TV Shows",        type: "series" },
      { folder: "WWE & AEW Wrestling",      type: "series" },
    ]
  },
  {
    base: "http://172.16.50.12",
    share: "DHAKA-FLIX-12",
    categories: [
      { folder: "TV-WEB-Series", type: "series" },
    ]
  },
];

const VIDEO_EXTS = ["mkv", "mp4", "avi", "mov", "m4v"];

function buildUrl(base, fullPath) {
  const segments = fullPath.split("/").filter(Boolean);
  const encoded = segments.map(s => encodeURIComponent(s)).join("/");
  return `${base}/${encoded}/`;
}

function buildFileUrl(base, fullPath) {
  const segments = fullPath.split("/").filter(Boolean);
  const encoded = segments.map(s => encodeURIComponent(s)).join("/");
  return `${base}/${encoded}`;
}

async function listDir(base, path) {
  const url = buildUrl(base, path);
  try {
    const { data } = await axios.get(url, { timeout: 10000 });
    const $ = cheerio.load(data);
    const items = [];
    $("a").each((_, el) => {
      const href = $(el).attr("href");
      const name = $(el).text().trim();
      if (
        !href ||
        href.startsWith("?") ||
        href.startsWith("http") ||
        href.startsWith("..") ||
        name === ".." ||
        name === "Parent Directory" ||
        name === ""
      ) return;

      // server returns absolute paths e.g. /DHAKA-FLIX-9/Documentary/MovieName/
      const cleanPath = decodeURIComponent(href.replace(/^\//, "").replace(/\/$/, ""));
      const isDir = href.endsWith("/");
      const itemName = cleanPath.split("/").pop();
      items.push({ name: itemName, fullPath: cleanPath, isDir });
    });
    return items;
  } catch (err) {
    console.warn(`  [SKIP] ${path} → ${err.message}`);
    return [];
  }
}

function isVideo(name) {
  return VIDEO_EXTS.includes(name.split(".").pop().toLowerCase());
}

function cleanTitle(filename) {
  let t = filename.replace(/\.[^.]+$/, "");
  t = t.replace(/\b(1080p|720p|480p|576p|2160p|4K|UHD|BluRay|WEBRip|WEB-DL|HDTV|BRRip|DVDRip|x264|x265|HEVC|AAC|AC3|DTS|HDR|NF|AMZN|DSNP|ATVP|iT|iP|REPACK|PROPER|Dual\s?Audio|Multi\s?Audio)\b.*/i, "");
  t = t.replace(/[._]/g, " ").replace(/\s+/g, " ").trim();
  return t;
}

function extractYear(str) {
  const m = str.match(/\b(19|20)\d{2}\b/);
  return m ? m[0] : null;
}

async function scanMovies(base, share, folder) {
  const movies = [];
  const catPath = `${share}/${folder}`;
  const topItems = await listDir(base, catPath);

  for (const item of topItems) {
    if (item.isDir) {
      const subItems = await listDir(base, item.fullPath);
      for (const sub of subItems) {
        if (!sub.isDir && isVideo(sub.name)) {
          // year folder → video file
          movies.push({
            title: cleanTitle(sub.name),
            filename: sub.name,
            year: extractYear(item.name),
            category: folder,
            server: base,
            streamUrl: buildFileUrl(base, sub.fullPath),
          });
        } else if (sub.isDir) {
          // year folder → movie subfolder → video file
          const deepItems = await listDir(base, sub.fullPath);
          for (const d of deepItems) {
            if (!d.isDir && isVideo(d.name)) {
              movies.push({
                title: cleanTitle(sub.name),
                filename: d.name,
                year: extractYear(item.name),
                category: folder,
                server: base,
                streamUrl: buildFileUrl(base, d.fullPath),
              });
            }
          }
        }
      }
    } else if (isVideo(item.name)) {
      // flat — video directly in category root
      movies.push({
        title: cleanTitle(item.name),
        filename: item.name,
        year: null,
        category: folder,
        server: base,
        streamUrl: buildFileUrl(base, item.fullPath),
      });
    }
  }
  return movies;
}

async function scanSeries(base, share, folder) {
  const seriesList = [];
  const catPath = `${share}/${folder}`;
  const topItems = await listDir(base, catPath);

  for (const top of topItems) {
    if (!top.isDir) continue;

    // peek inside to determine if this is a grouping folder or an actual show
    const topChildren = await listDir(base, top.fullPath);
    const hasSubFolders = topChildren.some(c => c.isDir);

    let shows = [];
    if (hasSubFolders) {
      // grouping folder (letter / symbol / year) → children are shows
      shows = topChildren.filter(s => s.isDir);
    } else {
      // top level IS the show
      shows = [top];
    }

    for (const show of shows) {
      const showChildren = show === top ? topChildren : await listDir(base, show.fullPath);
      const seasonData = [];

      for (const season of showChildren) {
        if (!season.isDir) continue;
        const eps = await listDir(base, season.fullPath);
        const episodes = eps
          .filter(e => !e.isDir && isVideo(e.name))
          .map(e => ({
            filename: e.name,
            streamUrl: buildFileUrl(base, e.fullPath),
          }));
        if (episodes.length) seasonData.push({ season: season.name, episodes });
      }

      // flat episodes directly under show (no season subfolders)
      const flatEps = showChildren.filter(s => !s.isDir && isVideo(s.name));
      if (flatEps.length) {
        seasonData.push({
          season: "Season 1",
          episodes: flatEps.map(e => ({
            filename: e.name,
            streamUrl: buildFileUrl(base, e.fullPath),
          })),
        });
      }

      if (seasonData.length) {
        seriesList.push({
          title: show.name,
          category: folder,
          server: base,
          seasons: seasonData,
        });
      }
    }
  }
  return seriesList;
}

async function buildCatalog() {
  const catalog = {
    movies: [],
    series: [],
    generatedAt: new Date().toISOString(),
  };

  for (const server of SERVERS) {
    for (const cat of server.categories) {
      console.log(`Scanning [${cat.type}] ${server.base}/${server.share}/${cat.folder}`);
      try {
        if (cat.type === "movie") {
          const movies = await scanMovies(server.base, server.share, cat.folder);
          console.log(`  → ${movies.length} movies`);
          catalog.movies.push(...movies);
        } else {
          const series = await scanSeries(server.base, server.share, cat.folder);
          console.log(`  → ${series.length} series`);
          catalog.series.push(...series);
        }
      } catch (err) {
        console.error(`  [ERROR] ${err.message}`);
      }
    }
  }

  fs.writeFileSync("catalog.json", JSON.stringify(catalog, null, 2));
  console.log(`\n✓ Done. Movies: ${catalog.movies.length} | Series: ${catalog.series.length}`);
  console.log(`✓ Saved to catalog.json`);
}

buildCatalog().catch(console.error);
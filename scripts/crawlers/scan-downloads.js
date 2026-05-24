const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT_DIR = path.resolve(__dirname, "..", "..");
const OUTPUT_FILE = path.join(ROOT_DIR, "data", "catalogs", "downloads-catalog.json");
const ROOTS_FILE = path.join(__dirname, "downloads-roots.json");
const MAX_DEPTH = parseInt(process.env.DOWNLOAD_SCAN_DEPTH || "6", 10);
const REQUEST_TIMEOUT = parseInt(process.env.DOWNLOAD_SCAN_TIMEOUT || "15000", 10);

const ROOT_FOLDER_NAMES = [
  "Software",
  "Tutorial & Training",
  "Tutorial",
  "Android Games",
  "Computer Games",
  "Console Games",
  "OS",
  "Operating System",
  "Apps",
  "APK",
  "Games"
];

const DEFAULT_BASE_SERVERS = [
  "http://172.16.50.9/DHAKA-FLIX-9/"
];

const ALLOWED_EXTS = new Set([
  "exe", "msi",
  "apk", "xapk", "apks",
  "zip", "rar", "7z",
  "iso", "img",
  "dmg", "pkg",
  "pdf", "txt",
  "nsp", "xci", "cia", "3ds", "gba", "nds", "nes", "snes", "wbfs"
]);

const IGNORE_EXTS = new Set([
  "html", "php", "js", "css",
  "jpg", "jpeg", "png", "webp", "gif",
  "mp4", "mkv", "avi", "mov", "m4v", "m3u8",
  "srt", "vtt", "ass"
]);

const CONSOLE_EXTS = new Set(["nsp", "xci", "cia", "3ds", "gba", "nds", "nes", "snes", "wbfs"]);
const ARCHIVE_EXTS = new Set(["zip", "rar", "7z"]);
const ANDROID_EXTS = new Set(["apk", "xapk", "apks"]);
const WINDOWS_EXTS = new Set(["exe", "msi"]);
const MAC_EXTS = new Set(["dmg", "pkg"]);
const DISK_EXTS = new Set(["iso", "img"]);
const DOC_EXTS = new Set(["pdf", "txt"]);

function ensureTrailingSlash(url) {
  return String(url || "").trim().replace(/\/?$/, "/");
}

function encodeFolder(folder) {
  return folder.split("/").map(part => encodeURIComponent(part)).join("/") + "/";
}

function parseJsonEnv(name) {
  if (!process.env[name]) return null;
  try {
    const parsed = JSON.parse(process.env[name]);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function parseCsvEnv(name) {
  return String(process.env[name] || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
}

function loadRootsFile() {
  try {
    if (!fs.existsSync(ROOTS_FILE)) return [];
    const data = JSON.parse(fs.readFileSync(ROOTS_FILE, "utf8"));
    return Array.isArray(data) ? data : Array.isArray(data.roots) ? data.roots : [];
  } catch (err) {
    console.warn(`[WARN] Could not read downloads-roots.json: ${err.message}`);
    return [];
  }
}

function normalizeRoot(root) {
  const raw = typeof root === "string" ? { url: root } : root;
  if (!raw || !raw.url) return null;

  try {
    const url = ensureTrailingSlash(raw.url);
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;

    return {
      url,
      label: raw.label || `${parsed.host}${decodeURIComponent(parsed.pathname)}`,
      scanAllInside: raw.scanAllInside !== false,
      parsed
    };
  } catch {
    return null;
  }
}

function buildDefaultRoots() {
  const bases = parseCsvEnv("DOWNLOAD_BASE_SERVERS");
  const baseServers = bases.length ? bases : DEFAULT_BASE_SERVERS;

  return baseServers.flatMap(base => {
    try {
      const baseUrl = ensureTrailingSlash(base);
      return ROOT_FOLDER_NAMES.map(folder => ({
        url: new URL(encodeFolder(folder), baseUrl).href,
        label: `${new URL(baseUrl).host} ${folder}`,
        scanAllInside: true
      }));
    } catch {
      return [];
    }
  });
}

function getConfiguredRoots() {
  const envJson = parseJsonEnv("DOWNLOAD_ROOTS_JSON");
  const envCsv = parseCsvEnv("DOWNLOAD_ROOTS");
  const fileRoots = loadRootsFile();
  const rawRoots = [
    ...(envJson || []),
    ...envCsv,
    ...fileRoots
  ];

  const roots = rawRoots.length ? rawRoots : buildDefaultRoots();
  const normalized = roots.map(normalizeRoot).filter(Boolean);
  const byUrl = new Map(normalized.map(root => [root.url, root]));
  return Array.from(byUrl.values());
}

function cleanUrlPathname(url) {
  try {
    return decodeURIComponent(new URL(url).pathname);
  } catch {
    return "";
  }
}

function hasPathTraversal(url) {
  const pathname = cleanUrlPathname(url);
  return pathname.split("/").some(part => part === "..");
}

function isInsideRoot(root, fullUrl) {
  try {
    const parsed = new URL(fullUrl);
    return parsed.origin === root.parsed.origin &&
      parsed.pathname.startsWith(root.parsed.pathname) &&
      !hasPathTraversal(fullUrl);
  } catch {
    return false;
  }
}

function normalizeUrl(root, base, href) {
  if (!href) return null;
  const h = String(href).trim();
  if (!h || h.startsWith("?") || h.startsWith("#") || /^javascript:/i.test(h)) return null;

  try {
    const fullUrl = new URL(h, base).href;
    return isInsideRoot(root, fullUrl) ? fullUrl : null;
  } catch {
    return null;
  }
}

function getExt(nameOrUrl) {
  try {
    const parsed = new URL(nameOrUrl);
    return path.extname(parsed.pathname).replace(".", "").toLowerCase();
  } catch {
    const clean = String(nameOrUrl || "").split("?")[0].split("#")[0];
    return path.extname(clean).replace(".", "").toLowerCase();
  }
}

function cleanName(filename) {
  return decodeURIComponent(filename)
    .replace(/\.[^.]+$/, "")
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function makeId(url) {
  return crypto.createHash("sha1").update(url).digest("hex").slice(0, 16);
}

function filenameFromUrl(fullUrl, fallbackName) {
  try {
    const parsed = new URL(fullUrl);
    const decoded = decodeURIComponent(parsed.pathname);
    const base = path.posix.basename(decoded);
    return base || decodeURIComponent(fallbackName || "");
  } catch {
    return decodeURIComponent(fallbackName || "");
  }
}

function sourcePathFromUrl(fullUrl) {
  try {
    return decodeURIComponent(new URL(fullUrl).pathname).replace(/^\/+/, "");
  } catch {
    return "";
  }
}

function sourceServerFromUrl(fullUrl) {
  try {
    return new URL(fullUrl).origin;
  } catch {
    return "";
  }
}

function parseSize(text) {
  const match = String(text || "").match(/(\d+(?:\.\d+)?)\s*(B|KB|KiB|MB|MiB|GB|GiB|TB|TiB)\b/i);
  if (!match) return null;
  const value = parseFloat(match[1]);
  const unit = match[2].toLowerCase();
  const powers = { b: 0, kb: 1, kib: 1, mb: 2, mib: 2, gb: 3, gib: 3, tb: 4, tib: 4 };
  if (!Number.isFinite(value) || powers[unit] === undefined) return null;
  return Math.round(value * Math.pow(1024, powers[unit]));
}

function detectPlatform(ext) {
  if (ANDROID_EXTS.has(ext)) return "Android";
  if (WINDOWS_EXTS.has(ext)) return "Windows";
  if (MAC_EXTS.has(ext)) return "macOS";
  if (DISK_EXTS.has(ext)) return "OS / Disk Image";
  if (CONSOLE_EXTS.has(ext)) return "Console";
  if (ARCHIVE_EXTS.has(ext)) return "Archive";
  return "Other";
}

function detectCategory(ext, url) {
  const p = decodeURIComponent(String(url || "")).toLowerCase();

  if (p.includes("android") || ANDROID_EXTS.has(ext)) return "Android";
  if (p.includes("console") || CONSOLE_EXTS.has(ext)) return "Console Games";
  if (p.includes("computer games") || p.includes("/games/") || p.includes("game")) return "Games";
  if (p.includes("software") || p.includes("/apps/") || WINDOWS_EXTS.has(ext) || MAC_EXTS.has(ext)) return "Software";
  if (p.includes("operating system") || p.includes("/os/") || DISK_EXTS.has(ext)) return "OS";
  if (ARCHIVE_EXTS.has(ext)) return "Archives";
  if (p.includes("tutorial") || p.includes("training") || DOC_EXTS.has(ext)) return "Tutorial & Training";

  return "Downloads";
}

function detectType(ext, url) {
  const p = decodeURIComponent(String(url || "")).toLowerCase();
  if (WINDOWS_EXTS.has(ext) || MAC_EXTS.has(ext)) return "software";
  if (ANDROID_EXTS.has(ext)) return "android";
  if (CONSOLE_EXTS.has(ext) || p.includes("game")) return "game";
  if (DISK_EXTS.has(ext)) return "os";
  if (ARCHIVE_EXTS.has(ext)) return "archive";
  if (DOC_EXTS.has(ext)) return "document";
  return "download";
}

async function listDir(root, url) {
  try {
    const { data } = await axios.get(url, {
      timeout: REQUEST_TIMEOUT,
      maxRedirects: 2,
      validateStatus: status => status >= 200 && status < 400,
      headers: { "User-Agent": "Mozilla/5.0 StreamVault-DownloadScanner" }
    });

    const $ = cheerio.load(String(data || ""));
    const items = [];

    $("a").each((_, el) => {
      const href = $(el).attr("href");
      const text = $(el).text().trim();
      const fullUrl = normalizeUrl(root, url, href);
      if (!fullUrl) return;

      const cleanText = text || href;
      if (cleanText === ".." || cleanText.toLowerCase().includes("parent directory")) return;

      const hrefPath = (() => {
        try { return new URL(fullUrl).pathname; } catch { return String(href || ""); }
      })();
      const ext = getExt(fullUrl);
      const isDir = String(href || "").endsWith("/") || (!ext && !path.posix.basename(hrefPath).includes("."));
      const rowText = $(el).closest("tr,li,pre").text();

      items.push({
        name: cleanText,
        fullUrl,
        isDir,
        size: parseSize(rowText)
      });
    });

    return items;
  } catch (err) {
    console.log(`[SKIP] ${url} -> ${err.message}`);
    return [];
  }
}

async function scanDir(root, url, depth, items, visited) {
  if (depth > MAX_DEPTH) return;
  if (visited.has(url)) return;
  visited.add(url);

  console.log(`[SCAN] ${url}`);
  const entries = await listDir(root, url);

  for (const entry of entries) {
    const ext = getExt(entry.fullUrl);

    if (entry.isDir) {
      await scanDir(root, ensureTrailingSlash(entry.fullUrl), depth + 1, items, visited);
      continue;
    }

    if (!ext || IGNORE_EXTS.has(ext) || !ALLOWED_EXTS.has(ext)) continue;

    const filename = filenameFromUrl(entry.fullUrl, entry.name);
    const item = {
      id: makeId(entry.fullUrl),
      name: cleanName(filename),
      filename,
      category: detectCategory(ext, entry.fullUrl),
      platform: detectPlatform(ext),
      type: detectType(ext, entry.fullUrl),
      size: entry.size,
      extension: ext,
      sourceServer: sourceServerFromUrl(entry.fullUrl),
      sourcePath: sourcePathFromUrl(entry.fullUrl),
      downloadUrl: entry.fullUrl,
      icon: null,
      addedAt: new Date().toISOString()
    };

    items.push(item);
    console.log(`[FOUND] ${item.platform} | ${item.filename}`);
  }
}

async function main() {
  const roots = getConfiguredRoots();
  console.log(`[DOWNLOAD SCAN] Starting with ${roots.length} root(s)`);
  if (!roots.length) {
    console.log("[DONE] No roots configured.");
    return;
  }

  const items = [];
  const visited = new Set();

  for (const root of roots) {
    console.log(`\n[ROOT] ${root.label}`);
    await scanDir(root, root.url, 0, items, visited);
  }

  const unique = Array.from(new Map(items.map(i => [i.id, i])).values())
    .sort((a, b) => a.name.localeCompare(b.name));

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify({ items: unique }, null, 2), "utf8");

  console.log(`\n[DONE] ${unique.length} downloadable items found.`);
  console.log(`[SAVED] ${OUTPUT_FILE}`);
}

main().catch(err => {
  console.error("[ERROR]", err);
  process.exitCode = 1;
});

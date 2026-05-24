const fs = require("fs");
const path = require("path");
const readline = require("readline");

const ROOT = process.cwd();
const OUT = path.join(ROOT, "scan-output");
fs.mkdirSync(OUT, { recursive: true });

const MEDIA_RE = /(?:https?:\/\/|ftp:\/\/|[A-Z]:\\|\/)?[^"'<>|]+?\.(mp4|mkv|avi|mov|webm|m3u8|ts|flv|wmv|mpg|mpeg)(?:\?[^"'\s<>]*)?/gi;
const CATALOG_RE = /\.(json|sql|db|sqlite|sqlite3)$/i;

const seen = new Set();

const allOut = fs.createWriteStream(path.join(OUT, "all-media-files.jsonl"));
const missingOut = fs.createWriteStream(path.join(OUT, "missing-local-files.jsonl"));
const foundOut = fs.createWriteStream(path.join(OUT, "found-local-files.jsonl"));
const remoteOut = fs.createWriteStream(path.join(OUT, "remote-media-links.jsonl"));

let scanned = 0;
let found = 0;
let localFound = 0;
let localMissing = 0;
let remote = 0;

function walk(dir, list = []) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".git", "scan-output"].includes(item.name)) continue;

    const full = path.join(dir, item.name);

    if (item.isDirectory()) walk(full, list);
    else if (CATALOG_RE.test(item.name)) list.push(full);
  }
  return list;
}

function norm(v) {
  return String(v || "").trim().replace(/\\/g, "/");
}

function isRemote(v) {
  return /^(https?|ftp):\/\//i.test(v);
}

function existsLocal(v) {
  if (isRemote(v)) return null;

  const clean = v.replace(/^\/+/, "");
  return fs.existsSync(path.resolve(ROOT, clean)) || fs.existsSync(path.resolve(ROOT, v));
}

function write(obj) {
  const line = JSON.stringify(obj) + "\n";
  allOut.write(line);

  if (obj.status === "REMOTE") remoteOut.write(line);
  if (obj.status === "LOCAL_FOUND") foundOut.write(line);
  if (obj.status === "LOCAL_MISSING") missingOut.write(line);
}

async function scanFile(file) {
  scanned++;

  const rel = path.relative(ROOT, file);
  console.log(`Scanning: ${rel}`);

  const rl = readline.createInterface({
    input: fs.createReadStream(file, { encoding: "utf8", highWaterMark: 1024 * 1024 }),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    const matches = line.matchAll(MEDIA_RE);

    for (const m of matches) {
      const value = norm(m[0]);
      const key = value.toLowerCase();

      if (seen.has(key)) continue;
      seen.add(key);

      const check = existsLocal(value);

      let status = "UNKNOWN";
      if (check === null) {
        status = "REMOTE";
        remote++;
      } else if (check === true) {
        status = "LOCAL_FOUND";
        localFound++;
      } else {
        status = "LOCAL_MISSING";
        localMissing++;
      }

      found++;

      write({
        value,
        status,
        sourceFile: rel,
      });
    }
  }
}

async function main() {
  const files = walk(ROOT);

  for (const file of files) {
    await scanFile(file);
  }

  fs.writeFileSync(
    path.join(OUT, "summary.txt"),
`Catalog files scanned: ${scanned}
Unique media entries found: ${found}

Local files found: ${localFound}
Local files missing: ${localMissing}
Remote FTP/HTTP links: ${remote}

Output format: JSONL, one item per line.
`
  );

  allOut.end();
  missingOut.end();
  foundOut.end();
  remoteOut.end();

  console.log("\n✅ Scan complete");
  console.log(`📁 Output: ${OUT}`);
  console.log(`🎬 Unique media entries: ${found}`);
  console.log(`✅ Local found: ${localFound}`);
  console.log(`❌ Local missing: ${localMissing}`);
  console.log(`🌐 Remote links: ${remote}`);
}

main().catch(err => {
  console.error("❌ Scan failed:", err);
});
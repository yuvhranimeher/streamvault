const fs = require("fs");
const path = require("path");
const readline = require("readline");

const PARTS = path.join(process.cwd(), "scan-output", "parts");
const OUT = path.join(process.cwd(), "scan-output", "clean-catalog.json");

const EXT = /\.(mp4|mkv|avi|mov|webm|m3u8|ts)$/i;

const map = new Map();

function decode(v) {
  try { return decodeURIComponent(v); }
  catch { return v; }
}

function clean(v) {
  return decode(v)
    .replace(/\\/g, "/")
    .replace(/\s+/g, " ")
    .trim();
}

function titleFromPath(v) {
  return path.basename(v)
    .replace(EXT, "")
    .replace(/[._-]+/g, " ")
    .trim();
}

function bad(v) {
  return (
    v.length < 15 ||
    !EXT.test(v) ||
    v.includes("sample") ||
    v.includes("trailer") ||
    v.includes("/Subs/") ||
    v.includes(".srt")
  );
}

async function processFile(file) {
  const rl = readline.createInterface({
    input: fs.createReadStream(file),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line.trim()) continue;

    let item;

    try {
      item = JSON.parse(line);
    } catch {
      continue;
    }

    const value = clean(item.value || "");

    if (bad(value)) continue;

    if (!value.startsWith("http")) continue;

    const title = titleFromPath(value);
    const key = title.toLowerCase();

    if (!map.has(key)) {
      map.set(key, {
        title,
        url: value,
        source: item.sourceFile || "",
      });
    }
  }
}

async function main() {
  const files = fs.readdirSync(PARTS)
    .filter(x => x.endsWith(".jsonl"));

  for (const f of files) {
    console.log("Processing", f);
    await processFile(path.join(PARTS, f));
  }

  const arr = [...map.values()]
    .sort((a,b)=>a.title.localeCompare(b.title));

  fs.writeFileSync(OUT, JSON.stringify(arr, null, 2));

  console.log("\n✅ Clean catalog built");
  console.log("🎬 Entries:", arr.length);
  console.log("📁", OUT);
}

main();
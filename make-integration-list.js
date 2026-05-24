const fs = require("fs");
const path = require("path");
const readline = require("readline");

const ROOT = process.cwd();
const IN = path.join(ROOT, "scan-output", "all-media-files.jsonl");
const OUT = path.join(ROOT, "scan-output", "integration-candidates.jsonl");

const out = fs.createWriteStream(OUT);

const bad = [
  "sample", "trailer", "preview", "behind.the.scenes",
  "extras", "subtitle", "subtitles"
];

function cleanTitle(v) {
  return path.basename(v.split("?")[0])
    .replace(/\.(mp4|mkv|avi|mov|webm|m3u8|ts|flv|wmv|mpg|mpeg)$/i, "")
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  const rl = readline.createInterface({
    input: fs.createReadStream(IN, "utf8"),
    crlfDelay: Infinity,
  });

  let kept = 0;
  let skipped = 0;

  for await (const line of rl) {
    if (!line.trim()) continue;

    const item = JSON.parse(line);
    const lower = item.value.toLowerCase();

    if (bad.some(x => lower.includes(x))) {
      skipped++;
      continue;
    }

    item.titleGuess = cleanTitle(item.value);
    out.write(JSON.stringify(item) + "\n");
    kept++;
  }

  out.end();

  console.log("✅ Integration list ready");
  console.log(`✅ Kept: ${kept}`);
  console.log(`⛔ Skipped junk: ${skipped}`);
  console.log(`📁 ${OUT}`);
}

main();
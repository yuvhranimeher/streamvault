// check-all-roots.js
const axios = require("axios");
const cheerio = require("cheerio");

const SERVERS = [
  "http://172.16.50.4/DHAKA-FLIX-14",
  "http://172.16.50.7/DHAKA-FLIX-7",
  "http://172.16.50.9/DHAKA-FLIX-9",
  "http://172.16.50.12/DHAKA-FLIX-12",
  "http://172.16.50.14/DHAKA-FLIX-14",
];

async function checkRoot(base) {
  console.log(`\n=== ${base} ===`);
  try {
    const { data } = await axios.get(`${base}/`, { timeout: 5000 });
    const $ = cheerio.load(data);
    $("a").each((_, el) => {
      const href = $(el).attr("href");
      const name = $(el).text().trim();
      if (href && !href.startsWith("?") && !href.startsWith("http") && name !== ".." && name !== "Parent Directory") {
        console.log(`  "${name}" → ${href}`);
      }
    });
  } catch (err) {
    console.log(`  [ERROR] ${err.message}`);
  }
}

async function main() {
  for (const s of SERVERS) await checkRoot(s);
}

main().catch(console.error);
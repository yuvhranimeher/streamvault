// check-root.js
const axios = require("axios");
const cheerio = require("cheerio");

async function main() {
  const { data } = await axios.get("http://172.16.50.14/DHAKA-FLIX-14/");
  const $ = cheerio.load(data);
  $("a").each((_, el) => {
    const href = $(el).attr("href");
    const name = $(el).text().trim();
    if (href && !href.startsWith("?") && !href.startsWith("http") && name !== "..") {
      console.log(JSON.stringify(name), "→", href);
    }
  });
}

main().catch(console.error);
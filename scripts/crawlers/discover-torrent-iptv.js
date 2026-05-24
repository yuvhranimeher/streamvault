// discover-torrent-iptv.js
// StreamVault Torrent IPTV Server Crawler
// node discover-torrent-iptv.js

const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");

const ROOT_PAGE =
  "https://sites.google.com/view/bdixftpserverlist/torrent-iptv-servers-link";

const OUTPUT_FILE =
  "torrent-iptv-catalog.json";

const REQUEST_TIMEOUT = 15000;
const MAX_DEPTH = 2;

const visited = new Set();
const existingTitles = new Set();

const catalog = {
  generatedAt:
    new Date().toISOString(),
  total:0,
  channels:[]
};

const BLOCKED_DOMAINS = [
  "google.com",
  "googleusercontent.com",
  "gstatic.com",
  "schema.org",
  "w3.org",
  "facebook.com",
  "youtube.com",
  "youtu.be",
  "twitter.com",
  "x.com",
  "instagram.com",
  "linkedin.com",
  "yahoo.com",
  "docs.google.com",
  "accounts.google.com",
  "blog.schema.org"
];

function cleanUrl(url){

  return String(url || "")
    .replace(/&amp;/g,"&")
    .replace(/\\u0026/g,"&")
    .replace(/\\u003d/g,"=")
    .split("#")[0]
    .trim();
}

function normalizeTitle(title){

  return String(title || "")
    .toLowerCase()
    .replace(/[._\-]/g," ")
    .replace(/\s+/g," ")
    .trim();
}

function isBlocked(url){

  try{

    const host =
      new URL(url)
        .hostname
        .toLowerCase();

    return BLOCKED_DOMAINS.some(domain =>
      host.includes(domain)
    );

  }catch{

    return true;
  }
}

function looksLikeBDIX(url){

  const lower =
    url.toLowerCase();

  return (
    lower.includes("172.") ||
    lower.includes("10.") ||
    lower.includes("192.168") ||
    lower.includes("ftp") ||
    lower.includes(":8080") ||
    lower.includes(":8000") ||
    lower.includes("iptv") ||
    lower.includes("torrent")
  );
}

function isPlaylist(url){

  const lower =
    url.toLowerCase();

  return (
    lower.includes(".m3u") ||
    lower.includes(".m3u8")
  );
}

async function fetchText(url){

  try{

    const { data } =
      await axios.get(url,{
        timeout:REQUEST_TIMEOUT,
        responseType:"text",
        maxRedirects:5,
        headers:{
          "User-Agent":
            "Mozilla/5.0 StreamVaultCrawler"
        }
      });

    return data;

  }catch{

    console.log(
      `❌ FAILED: ${url}`
    );

    return null;
  }
}

function loadExistingCatalog(){

  if(
    !fs.existsSync(OUTPUT_FILE)
  ){
    return;
  }

  try{

    const old =
      JSON.parse(
        fs.readFileSync(
          OUTPUT_FILE,
          "utf8"
        )
      );

    if(
      Array.isArray(old.channels)
    ){

      for(const item of old.channels){

        const key =
          normalizeTitle(
            item.name || ""
          );

        if(key){
          existingTitles.add(key);
        }
      }
    }

    console.log(
      `📦 Existing titles: ${existingTitles.size}`
    );

  }catch{}
}

function saveCatalog(){

  catalog.total =
    catalog.channels.length;

  fs.writeFileSync(
    OUTPUT_FILE,
    JSON.stringify(
      catalog,
      null,
      2
    )
  );
}

async function processPlaylist(url){

  console.log(`
📺 PLAYLIST
${url}
`);

  const text =
    await fetchText(url);

  if(!text){
    return;
  }

  if(
    !text.includes("#EXTM3U")
  ){
    return;
  }

  const lines =
    text.split("\n");

  let current = null;

  for(const raw of lines){

    const line =
      raw.trim();

    if(
      line.startsWith("#EXTINF")
    ){

      current =
        line.split(",").pop()?.trim();

      continue;
    }

    if(
      current &&
      line &&
      !line.startsWith("#")
    ){

      const title =
        normalizeTitle(current);

      if(
        !title ||
        title.length < 3
      ){

        current = null;
        continue;
      }

      if(
        existingTitles.has(title)
      ){

        console.log(
          `⏩ SKIPPED: ${current}`
        );

        current = null;
        continue;
      }

      existingTitles.add(title);

      catalog.channels.push({
        name:current,
        stream:line,
        source:url
      });

      console.log(
        `✅ ${current}`
      );

      console.log(
        `📦 TOTAL: ${catalog.channels.length}`
      );

      saveCatalog();

      current = null;
    }
  }
}

async function crawl(url,depth=0){

  if(depth > MAX_DEPTH){
    return;
  }

  url = cleanUrl(url);

  if(!url){
    return;
  }

  if(
    visited.has(url)
  ){
    return;
  }

  visited.add(url);

  if(
    isBlocked(url)
  ){
    return;
  }

  if(
    !looksLikeBDIX(url)
  ){
    return;
  }

  console.log(`
🌐 ${url}
`);

  if(
    isPlaylist(url)
  ){

    await processPlaylist(url);

    return;
  }

  const html =
    await fetchText(url);

  if(!html){
    return;
  }

  // direct m3u response
  if(
    html.includes("#EXTM3U")
  ){

    await processPlaylist(url);

    return;
  }

  const $ =
    cheerio.load(html);

  const links = [];

  $("a").each((_,el)=>{

    const href =
      $(el).attr("href");

    if(!href){
      return;
    }

    try{

      const absolute =
        cleanUrl(
          new URL(
            href,
            url
          ).href
        );

      if(!absolute){
        return;
      }

      if(
        isBlocked(absolute)
      ){
        return;
      }

      if(
        !looksLikeBDIX(absolute)
      ){
        return;
      }

      links.push(absolute);

    }catch{}
  });

  for(const link of links){

    if(
      isPlaylist(link)
    ){

      await processPlaylist(link);

    }else{

      await crawl(
        link,
        depth + 1
      );
    }
  }
}

async function discoverServers(){

  console.log(`
=================================
 FETCHING TORRENT IPTV SERVERS
=================================
`);

  const html =
    await fetchText(ROOT_PAGE);

  if(!html){

    console.log(
      "❌ Failed fetching root page"
    );

    process.exit(1);
  }

  const matches =
    html.match(
      /https?:\/\/[^\s"'<>\\]+/gi
    ) || [];

  const servers =
    new Set();

  for(const raw of matches){

    const url =
      cleanUrl(raw);

    if(!url){
      continue;
    }

    if(
      isBlocked(url)
    ){
      continue;
    }

    if(
      looksLikeBDIX(url)
    ){

      servers.add(url);
    }
  }

  console.log(
    `✅ Found servers: ${servers.size}`
  );

  console.log(
    [...servers]
  );

  return [...servers];
}

async function main(){

  console.log(`
=================================
 STREAMVAULT TORRENT IPTV CRAWLER
=================================
`);

  loadExistingCatalog();

  const servers =
    await discoverServers();

  for(const server of servers){

    await crawl(server);
  }

  saveCatalog();

  console.log(`
=================================
 FINISHED
=================================

📦 Channels : ${catalog.total}
🔗 Visited  : ${visited.size}

💾 Saved:
${OUTPUT_FILE}

`);
}

main();
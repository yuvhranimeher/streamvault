// discover-bloggerbd-ftp.js
// Stable StreamVault FTP crawler
// node discover-bloggerbd-ftp.js

const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");

const ROOT =
  "https://www.bloggerbangladesh.com/2020/12/ftp-server-bd.html";

const OUTPUT =
  "bloggerbd-catalog.json";

const MAX_DEPTH = 3;
const REQUEST_TIMEOUT = 10000;

const visited = new Set();
const savedTitles = new Set();

const catalog = {
  generatedAt:
    new Date().toISOString(),
  total:0,
  movies:[]
};

const VIDEO_EXTENSIONS = [
  ".mp4",
  ".mkv",
  ".avi",
  ".mov",
  ".m4v",
  ".webm",
  ".ts"
];

const BLOCKED_DOMAINS = [
  "facebook.com",
  "youtube.com",
  "twitter.com",
  "instagram.com",
  "google.com",
  "gstatic.com",
  "schema.org",
  "w3.org"
];

const SKIP_FOLDERS = [
  "/islamic/",
  "/software/",
  "/games/",
  "/android/",
  "/windows/",
  "/linux/"
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

function shouldSkipFolder(url){

  const lower =
    url.toLowerCase();

  return SKIP_FOLDERS.some(folder =>
    lower.includes(folder)
  );
}

function looksLikeFTP(url){

  const lower =
    url.toLowerCase();

  return (
    lower.includes("ftp") ||
    lower.includes("172.") ||
    lower.includes("10.") ||
    lower.includes(":8080") ||
    lower.includes(":8000")
  );
}

function isVideo(url){

  const lower =
    url.toLowerCase();

  return VIDEO_EXTENSIONS.some(ext =>
    lower.endsWith(ext)
  );
}

function cleanTitle(filename){

  return decodeURIComponent(filename)
    .replace(/\.[^/.]+$/,"")
    .replace(/[._\-]/g," ")
    .replace(/\s+/g," ")
    .replace(
      /\b(1080p|720p|480p|bluray|webrip|web-dl|x264|x265|h264|h265)\b/gi,
      ""
    )
    .replace(/\s+/g," ")
    .trim();
}

async function fetchPage(url){

  try{

    const { data } =
      await axios.get(url,{
        timeout:REQUEST_TIMEOUT,
        responseType:"text",
        maxRedirects:5,
        validateStatus:()=>true,
        maxContentLength:
          10 * 1024 * 1024,
        maxBodyLength:
          10 * 1024 * 1024,
        headers:{
          "User-Agent":
            "Mozilla/5.0 StreamVaultCrawler"
        }
      });

    return data;

  }catch{

    console.log(
      `❌ FAILED ${url}`
    );

    return null;
  }
}

function saveCatalog(){

  catalog.total =
    catalog.movies.length;

  fs.writeFileSync(
    OUTPUT,
    JSON.stringify(
      catalog,
      null,
      2
    )
  );
}

function addMovie(url){

  const filename =
    path.basename(url);

  const title =
    cleanTitle(filename);

  const normalized =
    normalizeTitle(title);

  if(
    !normalized ||
    normalized.length < 3
  ){
    return;
  }

  if(
    savedTitles.has(normalized)
  ){
    return;
  }

  savedTitles.add(normalized);

  catalog.movies.push({
    title,
    url
  });

  console.log(`
🎬 ${title}
📦 ${catalog.movies.length}
`);

  saveCatalog();
}

async function crawl(url,depth=0){

  if(depth > MAX_DEPTH){
    return;
  }

  url =
    cleanUrl(url);

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
    shouldSkipFolder(url)
  ){
    return;
  }

  console.log(`
🌐 ${url}
`);

  if(
    isVideo(url)
  ){

    addMovie(url);

    return;
  }

  const html =
    await fetchPage(url);

  if(!html){
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
        shouldSkipFolder(absolute)
      ){
        return;
      }

      if(
        looksLikeFTP(absolute) ||
        isVideo(absolute)
      ){

        links.push(absolute);
      }

    }catch{}
  });

  for(const link of links){

    await crawl(
      link,
      depth + 1
    );
  }
}

async function discoverServers(){

  console.log(`
=================================
 FETCHING FTP SERVERS
=================================
`);

  const html =
    await fetchPage(ROOT);

  if(!html){

    console.log(
      "❌ Failed fetching root page"
    );

    process.exit(1);
  }

  const $ =
    cheerio.load(html);

  const servers =
    new Set();

  $("a").each((_,el)=>{

    const href =
      $(el).attr("href");

    if(!href){
      return;
    }

    const url =
      cleanUrl(href);

    if(
      !url
    ){
      return;
    }

    if(
      isBlocked(url)
    ){
      return;
    }

    if(
      looksLikeFTP(url)
    ){

      servers.add(url);
    }
  });

  console.log(
    `✅ SERVERS: ${servers.size}`
  );

  console.log(
    [...servers]
  );

  return [...servers];
}

async function main(){

  console.log(`
=================================
 BLOGGERBD FTP CRAWLER
=================================
`);

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

📦 MOVIES : ${catalog.total}
🔗 VISITED: ${visited.size}

💾 SAVED:
${OUTPUT}

`);
}

main();
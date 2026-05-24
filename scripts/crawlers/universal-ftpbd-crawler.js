// universal-ftpbd-crawler.js
// Crawls movies, series, softwares, games, ISOs, APKs, archives
// node universal-ftpbd-crawler.js

const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");

const ROOTS = [
  "https://server1.ftpbd.net/FTP-1/",
  "https://server2.ftpbd.net/FTP-2/",
  "https://server3.ftpbd.net/FTP-3/",
  "https://server4.ftpbd.net/FTP-4/",
  "https://server5.ftpbd.net/FTP-5/"
];

const OUTPUT =
  "universal-ftpbd-catalog.json";

const MAX_DEPTH = 5;
const REQUEST_TIMEOUT = 10000;

const visited = new Set();
const saved = new Set();

const catalog = {
  generatedAt:
    new Date().toISOString(),
  total:0,
  files:[]
};

const BLOCKED_DOMAINS = [
  "google.com",
  "browsehappy.com",
  "chromewebstore.google.com",
  "support.google.com",
  "facebook.com",
  "youtube.com",
  "twitter.com",
  "instagram.com",
  "schema.org",
  "w3.org",
  "gstatic.com"
];

const FILE_EXTENSIONS = [

  // video
  ".mp4",
  ".mkv",
  ".avi",
  ".mov",
  ".m4v",
  ".webm",
  ".ts",

  // software
  ".exe",
  ".msi",
  ".apk",
  ".xapk",
  ".apks",

  // archives
  ".zip",
  ".rar",
  ".7z",
  ".tar",
  ".gz",

  // images/os
  ".iso",
  ".img",

  // mac
  ".dmg",
  ".pkg",

  // documents
  ".pdf",

  // console
  ".nsp",
  ".xci",
  ".cia",
  ".3ds",
  ".gba",
  ".nds",
  ".nes",
  ".snes",
  ".wbfs"
];

const IGNORE_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".css",
  ".js",
  ".svg",
  ".woff",
  ".woff2",
  ".xml",
  ".html"
];

function cleanUrl(url){

  return String(url || "")
    .replace(/&amp;/g,"&")
    .replace(/\\u0026/g,"&")
    .replace(/\\u003d/g,"=")
    .split("#")[0]
    .trim();
}

function normalize(text){

  return String(text || "")
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

    return BLOCKED_DOMAINS.some(x =>
      host.includes(x)
    );

  }catch{

    return true;
  }
}

function getExtension(url){

  return path
    .extname(url)
    .toLowerCase();
}

function shouldIgnore(url){

  const ext =
    getExtension(url);

  return IGNORE_EXTENSIONS.includes(ext);
}

function isDownloadable(url){

  const ext =
    getExtension(url);

  return FILE_EXTENSIONS.includes(ext);
}

function cleanTitle(name){

  return decodeURIComponent(name)
    .replace(/\.[^/.]+$/,"")
    .replace(/[._\-]/g," ")
    .replace(
      /\b(1080p|720p|480p|bluray|webrip|web-dl|x264|x265|h264|h265|aac)\b/gi,
      ""
    )
    .replace(/\s+/g," ")
    .trim();
}

function detectCategory(url){

  const lower =
    url.toLowerCase();

  if(
    lower.includes("/movie") ||
    lower.includes("/film")
  ){
    return "Movies";
  }

  if(
    lower.includes("/series")
  ){
    return "Series";
  }

  if(
    lower.includes("/game")
  ){
    return "Games";
  }

  if(
    lower.includes("/software")
  ){
    return "Software";
  }

  if(
    lower.includes("/android")
  ){
    return "Android";
  }

  if(
    lower.includes("/anime")
  ){
    return "Anime";
  }

  return "Other";
}

function detectPlatform(ext){

  ext =
    ext.replace(".","");

  if(
    ["exe","msi"]
      .includes(ext)
  ){
    return "Windows";
  }

  if(
    ["apk","xapk","apks"]
      .includes(ext)
  ){
    return "Android";
  }

  if(
    ["dmg","pkg"]
      .includes(ext)
  ){
    return "macOS";
  }

  if(
    ["iso","img"]
      .includes(ext)
  ){
    return "OS";
  }

  if(
    [
      "nsp",
      "xci",
      "cia",
      "3ds",
      "gba",
      "nds",
      "nes",
      "snes",
      "wbfs"
    ].includes(ext)
  ){
    return "Console";
  }

  return "Other";
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
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
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
    catalog.files.length;

  fs.writeFileSync(
    OUTPUT,
    JSON.stringify(
      catalog,
      null,
      2
    )
  );
}

function addFile(url){

  const filename =
    path.basename(url);

  const title =
    cleanTitle(filename);

  const key =
    normalize(title);

  if(
    !key ||
    key.length < 3
  ){
    return;
  }

  if(
    saved.has(key)
  ){
    return;
  }

  saved.add(key);

  const ext =
    getExtension(url);

  catalog.files.push({
    title,
    url,
    extension:ext,
    category:
      detectCategory(url),
    platform:
      detectPlatform(ext),
    source:"ftpbd"
  });

  console.log(`
📦 ${title}
📁 ${catalog.files.length}
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
    shouldIgnore(url)
  ){
    return;
  }

  console.log(`
🌐 ${url}
`);

  if(
    isDownloadable(url)
  ){

    addFile(url);

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

      const targetHost =
        new URL(absolute)
          .hostname
          .toLowerCase();

      // stay inside ftpbd ecosystem only
      if(
        !targetHost.includes("ftpbd.net")
      ){
        return;
      }

      links.push(absolute);

    }catch{}
  });

  for(const link of links){

    await crawl(
      link,
      depth + 1
    );
  }
}

async function main(){

  console.log(`
=================================
 UNIVERSAL FTPBD CRAWLER
=================================
`);

  for(const root of ROOTS){

    await crawl(root);
  }

  saveCatalog();

  console.log(`
=================================
 FINISHED
=================================

📦 FILES   : ${catalog.total}
🔗 VISITED : ${visited.size}

💾 SAVED:
${OUTPUT}

`);
}

main();
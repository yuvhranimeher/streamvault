require("dotenv").config({ path: ".env.hostinger" });

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const ftp = require("basic-ftp");

const LIMIT = process.argv.includes("--all")
  ? Infinity
  : Number(process.argv.find(a => a.startsWith("--limit="))?.split("=")[1] || 20);

const RECONNECT_EVERY = Number(
  process.argv.find(a => a.startsWith("--reconnect-every="))?.split("=")[1] || 200
);

const FTP_HOST = process.env.HOSTINGER_FTP_HOST;
const FTP_USER = process.env.HOSTINGER_FTP_USER;
const FTP_PASS = process.env.HOSTINGER_FTP_PASS;
const FTP_ROOT = process.env.HOSTINGER_FTP_ROOT || "/public_html";

if (!FTP_HOST || !FTP_USER || !FTP_PASS) {
  console.error("Missing HOSTINGER_FTP_HOST / USER / PASS in .env.hostinger");
  process.exit(1);
}

const outMapPath = "hostinger-asset-map.json";
const tmpDir = ".asset-tmp";

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function loadMap() {
  if (!fs.existsSync(outMapPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(outMapPath, "utf8"));
  } catch {
    return {};
  }
}

const map = loadMap();

function saveMap() {
  fs.writeFileSync(outMapPath, JSON.stringify(map, null, 2));
}

function readJson(file) {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null;
}

function walk(obj, found = []) {
  if (!obj || typeof obj !== "object") return found;

  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string" && /^https?:\/\//i.test(v)) {
      if (/image\.tmdb\.org|\.png|\.jpg|\.jpeg|\.webp|\.svg/i.test(v)) {
        const type = /backdrop/i.test(k)
          ? "backdrops"
          : /logo/i.test(k)
          ? "channel-logos"
          : "posters";

        found.push({ url: v, type });
      }
    } else if (typeof v === "object") {
      walk(v, found);
    }
  }

  return found;
}

function extFromUrl(u) {
  const clean = u.split("?")[0].toLowerCase();
  if (clean.endsWith(".png")) return ".png";
  if (clean.endsWith(".webp")) return ".webp";
  if (clean.endsWith(".svg")) return ".svg";
  return ".jpg";
}

async function download(url, file) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(45000)
      });

      if (!res.ok) throw new Error(`${res.status} ${url}`);

      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(file, buf);
      return;
    } catch (e) {
      if (attempt === 3) throw e;
      await sleep(1500 * attempt);
    }
  }
}

let client = null;
let uploadsSinceReconnect = 0;

async function connectFtp() {
  if (client) {
    try { client.close(); } catch {}
  }

  client = new ftp.Client(60000);
  client.ftp.verbose = false;

  await client.access({
    host: FTP_HOST,
    user: FTP_USER,
    password: FTP_PASS,
    secure: false
  });

  uploadsSinceReconnect = 0;
}

async function uploadWithRetry(local, remoteDir, remoteName) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      if (!client || uploadsSinceReconnect >= RECONNECT_EVERY) {
        await connectFtp();
      }

      await client.ensureDir(remoteDir);
      await client.uploadFrom(local, remoteName);
      uploadsSinceReconnect++;
      return;
    } catch (e) {
      try { if (client) client.close(); } catch {}
      client = null;

      if (attempt === 4) throw e;
      await sleep(2000 * attempt);
    }
  }
}

(async () => {
  fs.mkdirSync(tmpDir, { recursive: true });

  const catalog = readJson("catalog.json");
  const channels = readJson("channels.json");

  const urls = [...walk(catalog), ...walk(channels)]
    .filter((x, i, arr) => arr.findIndex(y => y.url === x.url) === i)
    .filter(x => !map[x.url])
    .slice(0, LIMIT);

  console.log(`Already cached: ${Object.keys(map).length}`);
  console.log(`Uploading ${urls.length} assets...`);

  let ok = 0;
  let fail = 0;

  for (let i = 0; i < urls.length; i++) {
    const item = urls[i];
    const hash = crypto.createHash("sha1").update(item.url).digest("hex").slice(0, 16);
    const ext = extFromUrl(item.url);
    const name = `${hash}${ext}`;
    const local = path.join(tmpDir, name);
    const remoteDir = `${FTP_ROOT}/assets/poster-cache/${item.type}`;
    const publicPath = `/assets/poster-cache/${item.type}/${name}`;

    try {
      await download(item.url, local);
      await uploadWithRetry(local, remoteDir, name);

      map[item.url] = publicPath;
      saveMap();

      ok++;
      console.log(`[${i + 1}/${urls.length}] OK ${item.type}: ${publicPath}`);
    } catch (e) {
      fail++;
      console.log(`[${i + 1}/${urls.length}] FAIL ${item.url} -> ${e.message}`);
    }
  }

  try { if (client) client.close(); } catch {}

  console.log(`Done. OK=${ok}, FAIL=${fail}, total cached=${Object.keys(map).length}`);
  console.log(`Map saved: ${outMapPath}`);
})();
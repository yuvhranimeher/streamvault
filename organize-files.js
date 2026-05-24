const fs = require('fs');
const path = require('path');

const ROOT = __dirname;

const folders = {
  'data/db': [
    'streamvault.db',
    'file-index.db'
  ],

  'data/catalogs': [
    'catalog.json',
    'approved-clean-catalog.json',
    'software-library.json',
    'software-catalog.json',
    'channels.json',
    'downloads-catalog.json',
    'external-bdix-catalog.json',
    'ftpbd-catalog.json',
    'home-feed.json',
    'popular-titles-cache.json',
    'servers.json',
    'iptv-catalog.json',
    'universal-ftpbd-catalog.json',
    'bnet-media-catalog.json',
    'xhamster-catalog.json'
  ],

  'data/catalogs/archive': [
    'catalog.ndjson'
  ],

  'data/cache': [
    'poster-cache.json',
    'detail-cache.json',
    'section-cache.json',
    'episode-title-cache.json',
    'media-indexes.json',
    'live-tv-cache.json',
    'servers-status.json',
    'visited-urls.json'
  ],

  'data/rejected': [
    'rejected-media.json',
    'dead-live-streams.json'
  ],

  'data/logs': [
    '.log',
    'urls2.txt'
  ],

  'scripts/crawlers': [
    'crawl-media.js',
    'deep-media-crawler.js',
    'discover-servers.js',
    'discover-bloggerbd-ftp.js',
    'discover-live-tv.js',
    'discover-torrent-iptv.js',
    'ftp-scan.js',
    'scan-media.js',
    'scan-downloads.js',
    'universal-ftpbd-crawler.js',
    'fetch-server-links.js'
  ],

  'scripts/maintenance': [
    'build-database.js',
    'download-posters.js',
    'convert-catalog.js',
    'split-catalog.js',
    'retry-enrich.js',
    'enrich-catalog.js',
    'check-root.js',
    'check-roots.js',
    'check-servers.js',
    'detect-indexes.js',
    'check-enrichment.js'
  ]
};

const deleteFiles = [
  'reply.txt',
  '0.995',
  '{',
  'node',
  'netstat'
];

function ensureDir(dir) {
  fs.mkdirSync(path.join(ROOT, dir), {
    recursive: true
  });
}

function moveFile(file, targetDir) {

  const src = path.join(ROOT, file);

  if (!fs.existsSync(src)) return;

  const dest = path.join(ROOT, targetDir, file);

  try {

    fs.renameSync(src, dest);

    console.log(
      `Moved: ${file} -> ${targetDir}`
    );

  } catch (err) {

    console.log(
      `Failed: ${file}`,
      err.message
    );

  }
}

function deleteFile(file) {

  const full = path.join(ROOT, file);

  if (!fs.existsSync(full)) return;

  try {

    fs.unlinkSync(full);

    console.log(`Deleted: ${file}`);

  } catch (err) {

    console.log(
      `Failed deleting ${file}:`,
      err.message
    );

  }
}

for (const dir of Object.keys(folders)) {
  ensureDir(dir);
}

for (const [dir, rules] of Object.entries(folders)) {

  const filesNow = fs.readdirSync(ROOT);

  for (const file of filesNow) {

    const full = path.join(ROOT, file);

    if (!fs.existsSync(full)) continue;

    if (!fs.statSync(full).isFile()) continue;

    for (const rule of rules) {

      if (
        file === rule ||
        file.endsWith(rule)
      ) {

        moveFile(file, dir);

        break;
      }
    }
  }
}

for (const file of deleteFiles) {
  deleteFile(file);
}

console.log('\nDONE');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const INDEX = path.join(ROOT, 'index.html');
const API_ORIGIN = 'https://backend.streamvault.fit';

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
}

if (!fs.existsSync(INDEX)) {
  fail('hostinger/index.html is missing');
  process.exit();
}

const index = fs.readFileSync(INDEX, 'utf8');
const refs = [...index.matchAll(/(?:src|href)=["']([^"'#?]+)(?:[?#][^"']*)?["']/g)]
  .map(match => match[1])
  .filter(ref => ref.startsWith('/') && !ref.startsWith('//'));

for (const ref of [...new Set(refs)]) {
  const localPath = path.join(ROOT, ref.slice(1));
  if (!fs.existsSync(localPath)) fail(`referenced asset is missing: ${ref}`);
}

for (const jsonName of ['home-feed.json', 'boot-search-index.json', 'channels.json', 'catalog.json']) {
  const filename = path.join(ROOT, jsonName);
  if (!fs.existsSync(filename)) {
    fail(`static JSON is missing: ${jsonName}`);
    continue;
  }
  try {
    JSON.parse(fs.readFileSync(filename, 'utf8'));
  } catch (error) {
    fail(`${jsonName} is invalid JSON: ${error.message}`);
  }
}

const activeScripts = refs
  .filter(ref => ref.endsWith('.js'))
  .map(ref => path.join(ROOT, ref.slice(1)))
  .filter(fs.existsSync);
const textFiles = [INDEX, path.join(ROOT, 'runtime-config.js'), path.join(ROOT, 'sw.js'), ...activeScripts];
const windowsPath = /(?:^|[\s"'`(=])[A-Za-z]:[\\/]/m;
for (const filename of [...new Set(textFiles)]) {
  const source = fs.readFileSync(filename, 'utf8');
  if (windowsPath.test(source)) fail(`local Windows path found in ${path.basename(filename)}`);
}

const runtime = fs.readFileSync(path.join(ROOT, 'runtime-config.js'), 'utf8');
if (!runtime.includes(API_ORIGIN)) fail('runtime API origin is not centralized on backend.streamvault.fit');
if (/https:\/\/(?:www\.)?streamvault\.fit\/(?:api|live|live-relay|stream|subtitles)(?:\/|\?|['"`])/.test(
  activeScripts.map(filename => fs.readFileSync(filename, 'utf8')).join('\n')
)) {
  fail('an active script still routes a backend request through the frontend apex');
}

if (!process.exitCode) {
  console.log(`Hostinger deployment verified: ${new Set(refs).size} referenced assets, ${activeScripts.length} scripts`);
}

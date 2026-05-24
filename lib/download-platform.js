const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const crypto = require('crypto');

const DOWNLOAD_ID_RE = /^[A-Za-z0-9_-]{6,80}$/;
const ARCHIVE_EXTS = new Set(['zip', 'rar', '7z']);
const INSTALLER_EXTS = new Set(['exe', 'msi', 'apk', 'xapk', 'apks', 'dmg', 'pkg']);
const DISK_EXTS = new Set(['iso', 'img']);
const CONSOLE_EXTS = new Set(['nsp', 'xci', 'cia', '3ds', 'gba', 'nds', 'nes', 'snes', 'wbfs']);
const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']);
const PUBLIC_GROUP_FIELDS = [
  'id', 'name', 'filename', 'category', 'platform', 'type', 'extension', 'size', 'totalSize',
  'icon', 'version', 'releaseGroup', 'crackStatus', 'tags', 'updatedAt', 'partCount',
  'health', 'screenshots', 'banner', 'poster'
];
const HEALTH_ALGORITHM_VERSION = 2;

const RELEASE_GROUPS = [
  'FitGirl', 'DODI', 'ElAmigos', 'GOG', 'CODEX', 'CPY', 'FLT', 'PLAZA', 'SKIDROW',
  'RELOADED', 'Razor1911', 'EMPRESS', 'Goldberg', 'KaOs', 'RG Mechanics', 'xatab',
  'Black Box', 'CorePack', 'nosTEAM', 'SteamRIP', 'TinyRepacks', 'RUNE'
];

function loadJSON(file, fallback) {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {}
  return fallback;
}

function writeJSONAtomic(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}

function hash(value, length = 16) {
  return crypto.createHash('sha1').update(String(value || '')).digest('hex').slice(0, length);
}

function safeDecode(value) {
  const text = String(value || '');
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

function stripQuery(value) {
  return String(value || '').split('#')[0].split('?')[0];
}

function extensionOf(value) {
  try {
    return path.extname(new URL(String(value || '')).pathname).replace('.', '').toLowerCase();
  } catch {
    return path.extname(stripQuery(value)).replace('.', '').toLowerCase();
  }
}

function basenameOfUrl(value) {
  try {
    const parsed = new URL(String(value || ''));
    return safeDecode(path.posix.basename(parsed.pathname));
  } catch {
    return safeDecode(path.basename(stripQuery(value)));
  }
}

function dirnameOfUrl(value) {
  try {
    const parsed = new URL(String(value || ''));
    return `${parsed.origin}${safeDecode(path.posix.dirname(parsed.pathname))}`;
  } catch {
    return safeDecode(path.dirname(stripQuery(value)));
  }
}

function sourcePathFromUrl(value) {
  try {
    return safeDecode(new URL(String(value || '')).pathname).replace(/^\/+/, '');
  } catch {
    return '';
  }
}

function sourceServerFromUrl(value) {
  try {
    const parsed = new URL(String(value || ''));
    return parsed.origin;
  } catch {
    return '';
  }
}

function cleanDisplayName(value) {
  return safeDecode(value)
    .replace(/\.[A-Za-z0-9]{1,8}$/g, '')
    .replace(/\bpart\s*\d{1,4}\b/ig, '')
    .replace(/\.part\d{1,4}$/ig, '')
    .replace(/[._]+/g, ' ')
    .replace(/\s*-\s*/g, ' - ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeKey(value) {
  return cleanDisplayName(value)
    .toLowerCase()
    .replace(/\[[^\]]*]/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\bv(?:ersion)?\s*\d+(?:\.\d+){0,4}[a-z0-9-]*\b/ig, ' ')
    .replace(/\bbuild\s*\d+\b/ig, ' ')
    .replace(/\bpart\s*\d{1,4}\b/ig, ' ')
    .replace(/\b(?:fitgirl|dodi|elamigos|gog|codex|cpy|plaza|skidrow|reloaded|nosteam|steamrip|rune)\b/ig, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleCase(value) {
  return String(value || '').replace(/\w\S*/g, word =>
    word.charAt(0).toUpperCase() + word.slice(1)
  );
}

function sizeLabel(size) {
  const n = Number(size);
  if (!Number.isFinite(n) || n <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = n;
  let idx = 0;
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024;
    idx += 1;
  }
  return `${value >= 10 || idx === 0 ? Math.round(value) : value.toFixed(1)} ${units[idx]}`;
}

function coerceSize(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

function hostFromUrl(value) {
  try {
    return new URL(String(value || '')).host.toLowerCase();
  } catch {
    return '';
  }
}

function hasUrlPathTraversal(parsedUrl) {
  try {
    return decodeURIComponent(parsedUrl.pathname).split('/').some(part => part === '..');
  } catch {
    return true;
  }
}

function isPrivateDownloadHost(hostname) {
  const h = String(hostname || '').toLowerCase();
  if (!h) return false;
  if (h === 'localhost' || h.endsWith('.local')) return true;
  if (/^(127|10)\./.test(h)) return true;
  if (/^192\.168\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(h)) return true;
  return false;
}

function safeDownloadUrl(rawUrl, item = {}) {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) return null;
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }

  if (!['http:', 'https:', 'ftp:'].includes(parsed.protocol)) return null;
  if (parsed.username || parsed.password) return null;
  if (hasUrlPathTraversal(parsed)) return null;

  const allowedHosts = new Set(
    String(process.env.DOWNLOAD_ALLOWED_HOSTS || '')
      .split(',')
      .map(host => host.trim().toLowerCase())
      .filter(Boolean)
  );

  const host = parsed.host.toLowerCase();
  const sourceHost = hostFromUrl(item.sourceServer);
  if (sourceHost && sourceHost === host) return parsed.href;
  if (allowedHosts.has(host) || allowedHosts.has(parsed.hostname.toLowerCase())) return parsed.href;
  if (isPrivateDownloadHost(parsed.hostname)) return parsed.href;
  return null;
}

function detectPlatform(ext, text) {
  const value = String(text || '').toLowerCase();
  if (['apk', 'xapk', 'apks'].includes(ext) || value.includes('android')) return 'Android';
  if (['exe', 'msi'].includes(ext) || value.includes('windows') || value.includes('(pc)')) return 'Windows';
  if (['dmg', 'pkg'].includes(ext) || value.includes('mac')) return 'macOS';
  if (DISK_EXTS.has(ext) || value.includes('operating system') || value.includes('/os/')) return 'OS / Disk Image';
  if (CONSOLE_EXTS.has(ext) || value.includes('console')) return 'Console';
  if (ARCHIVE_EXTS.has(ext)) return 'Archive';
  return 'Other';
}

function detectCategory(ext, text) {
  const value = String(text || '').toLowerCase();
  if (value.includes('android') || ['apk', 'xapk', 'apks'].includes(ext)) return 'Android';
  if (value.includes('console') || CONSOLE_EXTS.has(ext)) return 'Console Games';
  if (value.includes('pc games') || value.includes('/games/') || value.includes('game')) return 'Games';
  if (value.includes('software') || value.includes('/apps/') || INSTALLER_EXTS.has(ext)) return 'Software';
  if (value.includes('operating system') || value.includes('/os/') || DISK_EXTS.has(ext)) return 'OS';
  if (ARCHIVE_EXTS.has(ext)) return 'Archives';
  if (['pdf', 'txt'].includes(ext) || value.includes('tutorial') || value.includes('training')) return 'Tutorial & Training';
  return 'Downloads';
}

function detectType(ext, text, category) {
  const value = `${text || ''} ${category || ''}`.toLowerCase();
  if (INSTALLER_EXTS.has(ext)) return ['apk', 'xapk', 'apks'].includes(ext) ? 'android' : 'software';
  if (CONSOLE_EXTS.has(ext) || value.includes('game')) return 'game';
  if (DISK_EXTS.has(ext)) return 'os';
  if (ARCHIVE_EXTS.has(ext)) return 'archive';
  if (['pdf', 'txt'].includes(ext)) return 'document';
  return 'download';
}

function detectPartNumber(filename) {
  const text = safeDecode(filename).toLowerCase();
  const match = text.match(/(?:^|[\s._-])part(?:[\s._-]?)(\d{1,4})(?:[\s._-]|\.|$)/i) ||
    text.match(/\.(?:r)(\d{2,4})$/i);
  if (!match) return null;
  const number = parseInt(match[1], 10);
  return Number.isFinite(number) ? number : null;
}

function detectArchiveBase(filename) {
  return safeDecode(filename)
    .replace(/\.(zip|rar|7z)$/i, '')
    .replace(/(?:^|[\s._-])part(?:[\s._-]?)\d{1,4}$/i, '')
    .replace(/\.r\d{2,4}$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstMatch(text, regexes) {
  for (const regex of regexes) {
    const match = String(text || '').match(regex);
    if (match) return match[1] || match[0];
  }
  return '';
}

function parseReleaseInfo(raw) {
  const fullText = [
    raw.name,
    raw.filename,
    raw.sourcePath,
    raw.downloadUrl,
    raw.category,
    raw.platform
  ].filter(Boolean).map(safeDecode).join(' ');

  const filenameName = cleanDisplayName(raw.name || raw.filename || basenameOfUrl(raw.downloadUrl));
  let title = filenameName || 'Untitled Download';
  title = title
    .replace(/\[[^\]]*repack[^\]]*]/ig, ' ')
    .replace(/\[[^\]]*crack[^\]]*]/ig, ' ')
    .replace(/\[[^\]]*no crack[^\]]*]/ig, ' ')
    .replace(/\([^)]*pc[^)]*\)/ig, ' ')
    .replace(/\bpart\s*\d{1,4}\b/ig, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const version = firstMatch(fullText, [
    /\bv(?:ersion)?[\s._-]*([0-9]+(?:\.[0-9]+){0,5}[a-z0-9-]*)\b/i,
    /\bbuild[\s._-]*([0-9][0-9a-z._-]*)\b/i
  ]);

  if (version) {
    title = title.replace(new RegExp(`\\bv(?:ersion)?[\\s._-]*${version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'), ' ');
  }

  let releaseGroup = '';
  for (const group of RELEASE_GROUPS) {
    const regex = new RegExp(`\\b${group.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (regex.test(fullText)) {
      releaseGroup = group;
      break;
    }
  }

  const crackStatus = (() => {
    const text = fullText.toLowerCase();
    if (/\bno[\s._-]*crack\b/.test(text)) return 'No crack included';
    if (/\bdrm[\s._-]*free\b/.test(text) || /\bgog\b/.test(text)) return 'DRM-free';
    if (/\bpre[\s._-]*cracked\b/.test(text)) return 'Pre-cracked';
    if (/\bcrack(?:ed)?\b/.test(text)) return 'Crack included';
    if (/\blauncher backup\b/.test(text) || /\bsteam backup\b/.test(text) || /\bepic games launcher backup\b/.test(text)) return 'Launcher backup';
    return 'Unknown';
  })();

  title = title
    .replace(new RegExp(`\\b(${RELEASE_GROUPS.map(g => g.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'ig'), ' ')
    .replace(/\brepack\b/ig, ' ')
    .replace(/\bcracked?\b/ig, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const tags = new Set();
  if (/repack/i.test(fullText)) tags.add('Repack');
  if (/fitgirl|dodi|elamigos|kaos|corepack/i.test(fullText)) tags.add('Repack');
  if (/android|apk|xapk|apks/i.test(fullText)) tags.add('Android');
  if (/pc games|\(pc\)|windows/i.test(fullText)) tags.add('PC');
  if (/console|nsp|xci|cia|wbfs/i.test(fullText)) tags.add('Console');
  if (/launcher backup|steam backup|epic games/i.test(fullText)) tags.add('Backup');
  if (ARCHIVE_EXTS.has(raw.extension)) tags.add('Archive');

  return {
    title: title || filenameName || 'Untitled Download',
    searchTitle: normalizeKey(title || filenameName),
    version: version || '',
    releaseGroup,
    crackStatus,
    tags: Array.from(tags)
  };
}

function shortHealth(health) {
  return {
    score: health?.score ?? 0,
    status: health?.status || 'UNKNOWN',
    badges: Array.isArray(health?.badges) ? health.badges.slice(0, 4) : [],
    updatedAt: health?.updatedAt || null
  };
}

function inferInstallGuide(group) {
  const exts = new Set(group.items.map(item => item.extension));
  const hasArchive = group.items.some(item => ARCHIVE_EXTS.has(item.extension));
  const hasIso = group.items.some(item => DISK_EXTS.has(item.extension));
  const hasApk = group.items.some(item => ['apk', 'xapk', 'apks'].includes(item.extension));
  const hasWindowsInstaller = group.items.some(item => ['exe', 'msi'].includes(item.extension));

  if (hasApk) {
    return [
      'Download all listed APK/XAPK/APKS files.',
      'Install from a trusted Android package installer.',
      'Keep Play Protect or your preferred scanner enabled before launch.'
    ];
  }
  if (hasIso) {
    return [
      'Download the disk image.',
      'Mount the ISO/IMG or extract it with an archive tool.',
      'Run the included installer or setup file, then apply any official updates you own.'
    ];
  }
  if (hasArchive) {
    return [
      'Download every archive part in the parts list.',
      'Keep all parts in the same folder.',
      'Extract from part 1 or the main archive using 7-Zip/WinRAR.',
      'Run setup/install if present and verify the extracted files before launching.'
    ];
  }
  if (hasWindowsInstaller) {
    return [
      'Download the installer.',
      'Scan the file before running it.',
      'Run as a normal user first; only elevate if the installer requires it.'
    ];
  }
  if (exts.has('dmg') || exts.has('pkg')) {
    return [
      'Download the macOS package.',
      'Open the DMG/PKG and follow the installer prompts.',
      'Review macOS security prompts before approving.'
    ];
  }
  return [
    'Download the file from a trusted mirror.',
    'Verify the file size and scan it before opening.',
    'Follow the documentation included by the publisher or uploader.'
  ];
}

function defaultSpecs(group) {
  const isGame = /game/i.test(group.category || group.type || '');
  const isAndroid = /android/i.test(group.platform || group.category || '');
  if (isAndroid) {
    return {
      minimum: ['Android 8.0+', '2 GB RAM', 'Enough free storage for the package and extracted data'],
      recommended: ['Android 11+', '4 GB RAM', 'Updated security patch level']
    };
  }
  if (isGame) {
    return {
      minimum: ['64-bit Windows 10', '8 GB RAM', 'DirectX 11 compatible GPU', 'Storage equal to download size plus extraction space'],
      recommended: ['64-bit Windows 10/11', '16 GB RAM', 'SSD storage', 'Current GPU driver']
    };
  }
  return {
    minimum: ['Compatible operating system', 'Enough free storage for download and extraction'],
    recommended: ['Current OS updates', 'SSD storage', 'Trusted archive and malware scanner']
  };
}

function galleryFromMetadata(metadata, group) {
  const images = [];
  const push = value => {
    const url = String(value || '').trim();
    if (/^(\/|https?:\/\/)/i.test(url) && !images.includes(url)) images.push(url);
  };

  (metadata.screenshots || []).forEach(push);
  push(metadata.banner);
  push(metadata.poster);
  group.items.forEach(item => {
    if (IMAGE_EXTS.has(item.extension)) push(item.downloadUrl);
  });
  return images.slice(0, 12);
}

function stripHtml(value) {
  return String(value || '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function httpsJson(url, timeout = 7000, options = {}) {
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch (err) {
      reject(err);
      return;
    }
    const client = parsed.protocol === 'http:' ? http : https;
    const req = client.request(parsed, {
      method: options.method || 'GET',
      timeout,
      headers: {
        'User-Agent': 'StreamVault-Metadata/1.0',
        ...(options.headers || {})
      }
    }, res => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on('timeout', () => req.destroy(new Error('metadata request timed out')));
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

function createDownloadPlatform(options = {}) {
  const rootDir = options.rootDir || process.cwd();
  const cacheDir = options.cacheDir || path.join(rootDir, 'cache');
  const catalogFiles = options.catalogFiles || [
    path.join(rootDir, 'data', 'catalogs', 'downloads-catalog.json'),
    path.join(rootDir, 'data', 'catalogs', 'software-catalog.json')
  ];
  const healthCacheFile = options.healthCacheFile || path.join(cacheDir, 'download-health-cache.json');
  const metadataCacheFile = options.metadataCacheFile || path.join(cacheDir, 'download-metadata-cache.json');

  let state = {
    mtimeKey: '',
    items: [],
    groups: [],
    byId: new Map(),
    groupById: new Map(),
    itemToGroup: new Map()
  };

  let healthCache = loadJSON(healthCacheFile, { version: 1, groups: {}, updatedAt: null });
  let metadataCache = loadJSON(metadataCacheFile, { version: 1, groups: {}, updatedAt: null });
  let healthSaveTimer = null;
  let metadataSaveTimer = null;
  const queuedGroups = new Set();
  const scanQueue = [];
  const scanner = {
    running: false,
    active: false,
    queued: 0,
    scanned: 0,
    skipped: 0,
    failed: 0,
    startedAt: null,
    finishedAt: null,
    lastId: null
  };

  function catalogMtimeKey() {
    return catalogFiles.map(file => {
      try {
        const stat = fs.statSync(file);
        return `${file}:${stat.mtimeMs}:${stat.size}`;
      } catch {
        return `${file}:missing`;
      }
    }).join('|');
  }

  function readCatalogEntries(file) {
    const raw = loadJSON(file, null);
    if (!raw) return [];
    if (Array.isArray(raw.items)) return raw.items;
    if (Array.isArray(raw.downloads)) {
      return raw.downloads.map(item => ({
        ...item,
        downloadUrl: item.downloadUrl || item.url,
        sourcePath: item.sourcePath || sourcePathFromUrl(item.url),
        sourceServer: item.sourceServer || sourceServerFromUrl(item.url),
        size: item.size ?? null
      }));
    }
    if (Array.isArray(raw)) return raw;
    return [];
  }

  function normalizeItem(raw) {
    const url = safeDownloadUrl(raw?.downloadUrl || raw?.url || raw?.href, raw);
    if (!url) return null;
    const filename = safeDecode(raw.filename || basenameOfUrl(url));
    const ext = String(raw.extension || extensionOf(filename || url)).toLowerCase();
    if (!ext) return null;
    const sourcePath = raw.sourcePath || sourcePathFromUrl(url);
    const sourceServer = raw.sourceServer || sourceServerFromUrl(url);
    const text = `${filename} ${sourcePath} ${sourceServer}`;
    const category = raw.category || detectCategory(ext, text);
    const platform = raw.platform && raw.platform !== 'Other' ? raw.platform : detectPlatform(ext, text);
    const type = raw.type || detectType(ext, text, category);
    const parsed = parseReleaseInfo({
      name: raw.name,
      filename,
      sourcePath,
      downloadUrl: url,
      category,
      platform,
      type,
      extension: ext
    });
    const id = String(raw.id || hash(url));
    if (!DOWNLOAD_ID_RE.test(id)) return null;

    return {
      id,
      name: parsed.title || cleanDisplayName(raw.name || filename),
      filename,
      category,
      platform,
      type,
      extension: ext,
      size: coerceSize(raw.size),
      sourceServer,
      sourcePath,
      downloadUrl: url,
      icon: raw.icon || null,
      addedAt: raw.addedAt || raw.createdAt || null,
      updatedAt: raw.updatedAt || raw.modifiedAt || raw.addedAt || null,
      version: raw.version || parsed.version || '',
      releaseGroup: raw.releaseGroup || parsed.releaseGroup || '',
      crackStatus: raw.crackStatus || parsed.crackStatus || 'Unknown',
      tags: Array.from(new Set([...(Array.isArray(raw.tags) ? raw.tags : []), ...parsed.tags])),
      searchTitle: parsed.searchTitle,
      partNumber: detectPartNumber(filename),
      archiveBase: detectArchiveBase(filename)
    };
  }

  function groupKeyForItem(item) {
    const dir = dirnameOfUrl(item.downloadUrl);
    const titleKey = normalizeKey(item.archiveBase || item.name || item.filename);
    const groupingExt = ARCHIVE_EXTS.has(item.extension) || item.partNumber || /game|software|android|os/i.test(`${item.category} ${item.type}`);
    if (groupingExt && dir) return `${dir}|${titleKey || normalizeKey(path.posix.basename(dir))}`;
    return `single:${item.id}`;
  }

  function choosePrimaryItem(items) {
    const sorted = [...items].sort((a, b) => {
      const score = item => {
        let value = 0;
        if (INSTALLER_EXTS.has(item.extension)) value += 40;
        if (DISK_EXTS.has(item.extension)) value += 35;
        if (ARCHIVE_EXTS.has(item.extension)) value += 25;
        if (item.partNumber === 1) value += 18;
        if (item.size) value += 6;
        if (item.updatedAt || item.addedAt) value += 2;
        return value;
      };
      return score(b) - score(a) || String(a.filename).localeCompare(String(b.filename));
    });
    return sorted[0] || items[0];
  }

  function buildGroup(groupKey, items) {
    const primary = choosePrimaryItem(items);
    const totalSize = items.reduce((sum, item) => sum + (Number(item.size) || 0), 0) || null;
    const latest = items
      .map(item => item.updatedAt || item.addedAt)
      .filter(Boolean)
      .sort()
      .pop() || null;
    const tags = Array.from(new Set(items.flatMap(item => item.tags || []))).slice(0, 12);
    const id = `g_${hash(groupKey)}`;

    return {
      id,
      key: groupKey,
      items: items.slice().sort(compareDownloadParts),
      primaryId: primary.id,
      name: primary.name,
      filename: primary.filename,
      category: primary.category,
      platform: primary.platform,
      type: primary.type,
      extension: primary.extension,
      size: primary.size,
      totalSize,
      icon: primary.icon,
      version: primary.version,
      releaseGroup: primary.releaseGroup,
      crackStatus: primary.crackStatus,
      tags,
      updatedAt: latest,
      fingerprint: fingerprintItems(items),
      searchTitle: primary.searchTitle || normalizeKey(primary.name),
      primary
    };
  }

  function compareDownloadParts(a, b) {
    const ap = a.partNumber ?? 999999;
    const bp = b.partNumber ?? 999999;
    return ap - bp || String(a.filename).localeCompare(String(b.filename));
  }

  function loadCatalog(force = false) {
    const key = catalogMtimeKey();
    if (!force && state.mtimeKey === key) return state;

    const normalized = [];
    const byId = new Map();
    for (const file of catalogFiles) {
      for (const raw of readCatalogEntries(file)) {
        const item = normalizeItem(raw);
        if (!item || byId.has(item.id)) continue;
        byId.set(item.id, item);
        normalized.push(item);
      }
    }

    const buckets = new Map();
    for (const item of normalized) {
      const groupKey = groupKeyForItem(item);
      if (!buckets.has(groupKey)) buckets.set(groupKey, []);
      buckets.get(groupKey).push(item);
    }

    const groups = Array.from(buckets, ([groupKey, items]) => buildGroup(groupKey, items))
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
    const groupById = new Map();
    const itemToGroup = new Map();
    groups.forEach(group => {
      groupById.set(group.id, group);
      group.items.forEach(item => itemToGroup.set(item.id, group));
    });

    state = {
      mtimeKey: key,
      items: normalized,
      groups,
      byId,
      groupById,
      itemToGroup
    };
    return state;
  }

  function groupForId(id) {
    loadCatalog();
    const cleanId = String(id || '');
    if (!DOWNLOAD_ID_RE.test(cleanId)) return null;
    return state.groupById.get(cleanId) || state.itemToGroup.get(cleanId) || null;
  }

  function itemForId(id) {
    loadCatalog();
    const cleanId = String(id || '');
    if (!DOWNLOAD_ID_RE.test(cleanId)) return null;
    return state.byId.get(cleanId) || null;
  }

  function fingerprintItems(items) {
    return hash(items.map(item => [
      item.id,
      item.filename,
      item.size || 0,
      item.updatedAt || item.addedAt || '',
      item.downloadUrl
    ].join(':')).join('|'), 32);
  }

  function groupFingerprint(group) {
    return group.fingerprint || fingerprintItems(group.items);
  }

  function scheduleHealthSave() {
    clearTimeout(healthSaveTimer);
    healthSaveTimer = setTimeout(() => {
      healthCache.updatedAt = new Date().toISOString();
      try {
        writeJSONAtomic(healthCacheFile, healthCache);
      } catch (err) {
        console.warn('[Downloads] Could not save health cache:', err.message);
      }
    }, 750);
  }

  function scheduleMetadataSave() {
    clearTimeout(metadataSaveTimer);
    metadataSaveTimer = setTimeout(() => {
      metadataCache.updatedAt = new Date().toISOString();
      try {
        writeJSONAtomic(metadataCacheFile, metadataCache);
      } catch (err) {
        console.warn('[Downloads] Could not save metadata cache:', err.message);
      }
    }, 750);
  }

  function cachedHealthForGroup(group) {
    const fingerprint = groupFingerprint(group);
    const cached = healthCache.groups?.[group.id];
    if (cached && cached.fingerprint === fingerprint && cached.algorithmVersion === HEALTH_ALGORITHM_VERSION) return cached;
    return null;
  }

  function archivePartsForGroup(group) {
    return group.items
      .filter(item => ARCHIVE_EXTS.has(item.extension) || item.partNumber)
      .sort(compareDownloadParts)
      .map((item, index) => ({
        id: item.id,
        name: item.filename,
        partNumber: item.partNumber || (group.items.length > 1 ? index + 1 : null),
        extension: item.extension,
        size: item.size,
        sizeLabel: sizeLabel(item.size),
        url: `/download/${encodeURIComponent(item.id)}`,
        mirrorCount: 1,
        status: item.size === 0 ? 'invalid-size' : 'available'
      }));
  }

  function computeHealth(group) {
    const issues = [];
    const warnings = [];
    const badges = [];
    let score = 100;
    const archiveItems = group.items.filter(item => ARCHIVE_EXTS.has(item.extension) || item.partNumber);
    const partNumbers = archiveItems.map(item => item.partNumber).filter(Number.isFinite);
    const hasArchive = archiveItems.length > 0;
    const hasInstaller = group.items.some(item => INSTALLER_EXTS.has(item.extension));
    const hasDisk = group.items.some(item => DISK_EXTS.has(item.extension));
    const hasUnknownSize = group.items.some(item => item.size == null);
    const zeroSize = group.items.filter(item => item.size === 0);
    const incomplete = group.items.filter(item => /\.(crdownload|download|part)$/i.test(item.filename));
    let duplicateParts = false;

    if (zeroSize.length) {
      issues.push(`${zeroSize.length} file(s) have invalid zero-byte size`);
      score -= 35;
    }
    if (incomplete.length) {
      issues.push(`${incomplete.length} incomplete upload marker(s) detected`);
      score -= 45;
    }

    if (partNumbers.length) {
      const unique = new Set(partNumbers);
      if (unique.size !== partNumbers.length) {
        duplicateParts = true;
        issues.push('Duplicate archive part numbers detected');
        score -= 30;
      }
      const min = Math.min(...partNumbers);
      const max = Math.max(...partNumbers);
      const missing = [];
      for (let n = min; n <= max; n += 1) {
        if (!unique.has(n)) missing.push(n);
      }
      if (min > 1) missing.unshift(1);
      if (missing.length) {
        issues.push(`Missing archive part(s): ${missing.slice(0, 12).join(', ')}${missing.length > 12 ? '...' : ''}`);
        score -= Math.min(55, 18 + missing.length * 5);
      } else if (!duplicateParts) {
        badges.push('Sequence OK');
      }
    } else if (hasArchive && archiveItems.length > 1) {
      warnings.push('Multiple archives found, but no numeric part sequence was detected');
      score -= 8;
    }

    if (hasArchive && !hasInstaller && !hasDisk) {
      warnings.push('Setup/ISO cannot be confirmed until archives are extracted');
      score -= hasUnknownSize ? 12 : 6;
    }
    if (!group.items.length) {
      issues.push('Empty catalog group');
      score = 0;
    }
    if (hasUnknownSize) {
      warnings.push('Some mirrors do not publish file sizes');
      score -= 7;
    }

    let status = 'VERIFIED';
    if (issues.some(issue => /duplicate|invalid|incomplete/i.test(issue))) status = 'CORRUPTED';
    else if (issues.some(issue => /missing/i.test(issue))) status = 'MISSING FILES';
    else if (warnings.length && hasUnknownSize) status = 'UNKNOWN';
    else if (warnings.length) status = 'PARTIAL';

    score = Math.max(0, Math.min(100, Math.round(score)));
    if (status === 'VERIFIED') badges.unshift('Verified');
    if (hasArchive) badges.push(`${archiveItems.length} archive part${archiveItems.length === 1 ? '' : 's'}`);
    if (hasInstaller) badges.push('Installer');
    if (hasDisk) badges.push('Disk image');
    if (group.releaseGroup) badges.push(group.releaseGroup);

    return {
      id: group.id,
      primaryId: group.primaryId,
      algorithmVersion: HEALTH_ALGORITHM_VERSION,
      fingerprint: groupFingerprint(group),
      score,
      status,
      badges: Array.from(new Set(badges)).slice(0, 8),
      issues,
      warnings,
      checkedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      scanner: {
        structural: true,
        deepArchiveCrc: false,
        note: 'Remote catalogs are structurally checked. Local CRC testing can be layered in when local archive paths are available.'
      }
    };
  }

  function getHealth(id, options = {}) {
    const group = groupForId(id);
    if (!group) return null;
    const cached = cachedHealthForGroup(group);
    if (cached) return cached;
    if (options.queue !== false) queueHealthScan(group.id, false);
    const health = computeHealth(group);
    healthCache.groups[group.id] = health;
    scheduleHealthSave();
    return health;
  }

  function queueHealthScan(id, force = false) {
    const group = groupForId(id);
    if (!group) return false;
    const cached = cachedHealthForGroup(group);
    if (!force && cached) {
      scanner.skipped += 1;
      return false;
    }
    if (queuedGroups.has(group.id)) return false;
    queuedGroups.add(group.id);
    scanQueue.push(group.id);
    scanner.queued = scanQueue.length;
    pumpScanQueue();
    return true;
  }

  function pumpScanQueue() {
    if (scanner.running) return;
    scanner.running = true;
    scanner.active = true;
    scanner.startedAt = scanner.startedAt || new Date().toISOString();
    scanner.finishedAt = null;

    setImmediate(() => {
      const started = Date.now();
      while (scanQueue.length && Date.now() - started < 70) {
        const groupId = scanQueue.shift();
        queuedGroups.delete(groupId);
        scanner.lastId = groupId;
        try {
          const group = groupForId(groupId);
          if (!group) {
            scanner.failed += 1;
            continue;
          }
          const health = computeHealth(group);
          healthCache.groups[group.id] = health;
          scanner.scanned += 1;
        } catch {
          scanner.failed += 1;
        }
      }
      scanner.queued = scanQueue.length;
      scanner.running = false;
      if (scanQueue.length) {
        setTimeout(pumpScanQueue, 25);
      } else {
        scanner.active = false;
        scanner.finishedAt = new Date().toISOString();
        scheduleHealthSave();
      }
    });
  }

  function rebuildHealthCache(force = false) {
    loadCatalog();
    state.groups.forEach(group => queueHealthScan(group.id, force));
    return scanStatus();
  }

  function queueStaleHealthScans(limit) {
    loadCatalog();
    const max = Number.isFinite(Number(limit)) ? Number(limit) : Number(process.env.DOWNLOAD_HEALTH_BOOT_MAX || 1500);
    let queued = 0;
    for (const group of state.groups) {
      if (queued >= max) break;
      if (queueHealthScan(group.id, false)) queued += 1;
    }
    return queued;
  }

  function scanStatus() {
    loadCatalog();
    const cachedCount = Object.keys(healthCache.groups || {}).length;
    return {
      active: scanner.active,
      queued: scanner.queued,
      scanned: scanner.scanned,
      skipped: scanner.skipped,
      failed: scanner.failed,
      startedAt: scanner.startedAt,
      finishedAt: scanner.finishedAt,
      lastId: scanner.lastId,
      catalogItems: state.items.length,
      catalogTitles: state.groups.length,
      cachedTitles: cachedCount
    };
  }

  function metadataFingerprint(group) {
    return hash(`${group.name}|${group.version}|${group.items.length}|${groupFingerprint(group)}`, 32);
  }

  function parsedMetadata(group) {
    const specs = defaultSpecs(group);
    return {
      fingerprint: metadataFingerprint(group),
      title: group.name,
      version: group.version || 'Unknown',
      description: `${group.name} is indexed from your StreamVault download catalog. Metadata is generated from filenames, folders, and cached provider data when available.`,
      genres: group.tags.filter(tag => !/archive|repack/i.test(tag)),
      developers: [],
      publishers: [],
      releaseDate: group.updatedAt || group.primary?.addedAt || null,
      rating: null,
      minimumSpecs: specs.minimum,
      recommendedSpecs: specs.recommended,
      screenshots: [],
      poster: group.icon || '',
      banner: '',
      source: 'Local parser',
      providers: []
    };
  }

  function getMetadata(group) {
    const fingerprint = metadataFingerprint(group);
    const cached = metadataCache.groups?.[group.id];
    if (cached && cached.fingerprint === fingerprint) return cached;
    const metadata = parsedMetadata(group);
    metadataCache.groups[group.id] = metadata;
    scheduleMetadataSave();
    if (process.env.DOWNLOAD_METADATA_AUTO === '1') {
      enrichMetadataInBackground(group.id).catch(() => {});
    }
    return metadata;
  }

  function cachedMetadataForGroup(group) {
    const fingerprint = metadataFingerprint(group);
    const cached = metadataCache.groups?.[group.id];
    return cached && cached.fingerprint === fingerprint ? cached : null;
  }

  async function fetchSteamMetadata(title) {
    const term = encodeURIComponent(String(title || '').slice(0, 80));
    const search = await httpsJson(`https://store.steampowered.com/api/storesearch/?term=${term}&cc=us&l=en`);
    const first = Array.isArray(search?.items) ? search.items[0] : null;
    if (!first?.id) return null;
    const details = await httpsJson(`https://store.steampowered.com/api/appdetails?appids=${encodeURIComponent(first.id)}&cc=us&l=en`);
    const app = details?.[first.id]?.data;
    if (!app) return null;
    return {
      title: app.name || first.name,
      description: String(app.short_description || '').replace(/<[^>]*>/g, ''),
      developers: Array.isArray(app.developers) ? app.developers : [],
      publishers: Array.isArray(app.publishers) ? app.publishers : [],
      genres: Array.isArray(app.genres) ? app.genres.map(g => g.description).filter(Boolean) : [],
      releaseDate: app.release_date?.date || null,
      minimumSpecs: app.pc_requirements?.minimum ? [String(app.pc_requirements.minimum).replace(/<[^>]*>/g, ' ')] : [],
      recommendedSpecs: app.pc_requirements?.recommended ? [String(app.pc_requirements.recommended).replace(/<[^>]*>/g, ' ')] : [],
      screenshots: Array.isArray(app.screenshots) ? app.screenshots.map(s => s.path_thumbnail || s.path_full).filter(Boolean) : [],
      poster: app.header_image || '',
      banner: app.background_raw || app.background || '',
      providers: ['Steam']
    };
  }

  async function fetchRawgMetadata(title) {
    const key = process.env.RAWG_API_KEY;
    if (!key) return null;
    const term = encodeURIComponent(String(title || '').slice(0, 80));
    const search = await httpsJson(`https://api.rawg.io/api/games?key=${encodeURIComponent(key)}&search=${term}&page_size=1`);
    const game = Array.isArray(search?.results) ? search.results[0] : null;
    if (!game?.id) return null;
    let details = null;
    try {
      details = await httpsJson(`https://api.rawg.io/api/games/${encodeURIComponent(game.id)}?key=${encodeURIComponent(key)}`);
    } catch {}
    const image = game.background_image || details?.background_image || '';
    return {
      title: game.name || details?.name,
      description: details?.description_raw || stripHtml(details?.description || ''),
      developers: Array.isArray(details?.developers) ? details.developers.map(d => d.name).filter(Boolean) : [],
      publishers: Array.isArray(details?.publishers) ? details.publishers.map(p => p.name).filter(Boolean) : [],
      genres: Array.isArray(game.genres) ? game.genres.map(g => g.name).filter(Boolean) : [],
      releaseDate: game.released || details?.released || null,
      rating: game.rating || details?.rating || null,
      screenshots: image ? [image] : [],
      poster: image,
      banner: image,
      providers: ['RAWG']
    };
  }

  function igdbImage(url, size) {
    const value = String(url || '');
    if (!value) return '';
    const absolute = value.startsWith('//') ? `https:${value}` : value;
    return absolute.replace('/t_thumb/', `/${size || 't_screenshot_big'}/`);
  }

  async function fetchIgdbMetadata(title) {
    const clientId = process.env.IGDB_CLIENT_ID;
    const token = process.env.IGDB_ACCESS_TOKEN || process.env.IGDB_TOKEN;
    if (!clientId || !token) return null;
    const safeTitle = String(title || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').slice(0, 80);
    const body = [
      `search "${safeTitle}";`,
      'fields name,summary,first_release_date,total_rating,cover.url,screenshots.url,genres.name,involved_companies.company.name,involved_companies.developer,involved_companies.publisher;',
      'limit 1;'
    ].join(' ');
    const results = await httpsJson('https://api.igdb.com/v4/games', 7000, {
      method: 'POST',
      headers: {
        'Client-ID': clientId,
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'text/plain'
      },
      body
    });
    const game = Array.isArray(results) ? results[0] : null;
    if (!game) return null;
    const companies = Array.isArray(game.involved_companies) ? game.involved_companies : [];
    const screenshots = Array.isArray(game.screenshots) ? game.screenshots.map(s => igdbImage(s.url)).filter(Boolean) : [];
    const poster = igdbImage(game.cover?.url, 't_cover_big');
    return {
      title: game.name,
      description: game.summary || '',
      developers: companies.filter(c => c.developer).map(c => c.company?.name).filter(Boolean),
      publishers: companies.filter(c => c.publisher).map(c => c.company?.name).filter(Boolean),
      genres: Array.isArray(game.genres) ? game.genres.map(g => g.name).filter(Boolean) : [],
      releaseDate: game.first_release_date ? new Date(game.first_release_date * 1000).toISOString().slice(0, 10) : null,
      rating: game.total_rating ? Math.round(game.total_rating) / 10 : null,
      screenshots,
      poster,
      banner: screenshots[0] || poster,
      providers: ['IGDB']
    };
  }

  async function fetchGiantBombMetadata(title) {
    const key = process.env.GIANTBOMB_API_KEY;
    if (!key) return null;
    const term = encodeURIComponent(String(title || '').slice(0, 80));
    const url = `https://www.giantbomb.com/api/search/?api_key=${encodeURIComponent(key)}&format=json&query=${term}&resources=game&limit=1&field_list=name,deck,description,image,original_release_date,expected_release_year,developers,publishers,genres`;
    const search = await httpsJson(url);
    const game = Array.isArray(search?.results) ? search.results[0] : null;
    if (!game) return null;
    const image = game.image?.super_url || game.image?.screen_url || game.image?.medium_url || '';
    return {
      title: game.name,
      description: game.deck || stripHtml(game.description || ''),
      developers: Array.isArray(game.developers) ? game.developers.map(d => d.name).filter(Boolean) : [],
      publishers: Array.isArray(game.publishers) ? game.publishers.map(p => p.name).filter(Boolean) : [],
      genres: Array.isArray(game.genres) ? game.genres.map(g => g.name).filter(Boolean) : [],
      releaseDate: game.original_release_date || (game.expected_release_year ? String(game.expected_release_year) : null),
      screenshots: image ? [image] : [],
      poster: image,
      banner: image,
      providers: ['GiantBomb']
    };
  }

  function fetchAndroidCatalogMetadata(title, group) {
    if (!/android|apk|xapk|apks/i.test(`${group?.category || ''} ${group?.platform || ''} ${group?.extension || ''}`)) return null;
    const files = [
      process.env.APKPURE_METADATA_FILE,
      process.env.APKMIRROR_METADATA_FILE,
      path.join(cacheDir, 'android-metadata-cache.json')
    ].filter(Boolean);
    const key = normalizeKey(title);
    for (const file of files) {
      const raw = loadJSON(file, null);
      if (!raw) continue;
      const source = /mirror/i.test(file) ? 'APKMirror' : /pure/i.test(file) ? 'APKPure' : 'Android metadata cache';
      const records = Array.isArray(raw) ? raw : Array.isArray(raw.items) ? raw.items : Object.values(raw.items || raw);
      const match = records.find(record => normalizeKey(record.title || record.name || record.packageName || '') === key);
      if (!match) continue;
      return {
        title: match.title || match.name,
        description: match.description || match.summary || '',
        developers: match.developer ? [match.developer] : [],
        genres: Array.isArray(match.categories) ? match.categories : [],
        releaseDate: match.updatedAt || match.releaseDate || null,
        rating: match.rating || null,
        screenshots: Array.isArray(match.screenshots) ? match.screenshots : [],
        poster: match.icon || match.poster || '',
        banner: match.banner || '',
        providers: [source]
      };
    }
    return null;
  }

  function mergeMetadata(current, next) {
    if (!next) return current;
    const merged = { ...current };
    for (const [key, value] of Object.entries(next)) {
      if (key === 'providers') continue;
      if (Array.isArray(value)) {
        if (value.length) merged[key] = Array.from(new Set([...(merged[key] || []), ...value])).filter(Boolean);
      } else if (value && (!merged[key] || key === 'description' || key === 'banner' || key === 'poster')) {
        merged[key] = value;
      }
    }
    merged.providers = Array.from(new Set([...(current.providers || []), ...(next.providers || [])]));
    return merged;
  }

  async function enrichMetadataInBackground(id) {
    const group = groupForId(id);
    if (!group || !/(game|android|software)/i.test(`${group.category} ${group.type} ${group.platform}`)) return null;
    const current = getMetadata(group);
    if (current.providers?.length && current.enrichedAt) return current;
    let merged = current;
    for (const provider of [fetchSteamMetadata, fetchRawgMetadata, fetchIgdbMetadata, fetchGiantBombMetadata, fetchAndroidCatalogMetadata]) {
      try {
        merged = mergeMetadata(merged, await provider(group.name, group));
      } catch {}
    }
    if (!merged.providers?.length) return current;
    merged = {
      ...merged,
      fingerprint: metadataFingerprint(group),
      source: 'Local parser + provider cache',
      enrichedAt: new Date().toISOString()
    };
    metadataCache.groups[group.id] = merged;
    scheduleMetadataSave();
    return merged;
  }

  function mirrorsForGroup(group) {
    return group.items.map((item, index) => ({
      id: item.id,
      label: item.partNumber ? `Part ${item.partNumber}` : `Mirror ${index + 1}`,
      filename: item.filename,
      extension: item.extension,
      size: item.size,
      sizeLabel: sizeLabel(item.size),
      sourceServer: item.sourceServer,
      sourcePath: item.sourcePath,
      url: `/download/${encodeURIComponent(item.id)}`,
      copyUrl: `/download/${encodeURIComponent(item.id)}`,
      directHost: hostFromUrl(item.downloadUrl),
      resumable: true
    }));
  }

  function relatedForGroup(group) {
    loadCatalog();
    const terms = new Set((group.searchTitle || normalizeKey(group.name)).split(' ').filter(t => t.length > 2));
    return state.groups
      .filter(other => other.id !== group.id)
      .map(other => {
        let score = 0;
        if (other.category === group.category) score += 3;
        if (other.platform === group.platform) score += 2;
        for (const term of (other.searchTitle || '').split(' ')) {
          if (terms.has(term)) score += 1;
        }
        return { other, score };
      })
      .filter(row => row.score > 2)
      .sort((a, b) => b.score - a.score || String(a.other.name).localeCompare(String(b.other.name)))
      .slice(0, 12)
      .map(row => publicGroupItem(row.other));
  }

  function publicGroupItem(group) {
    const metadata = cachedMetadataForGroup(group) || {
      screenshots: [],
      poster: group.icon || '',
      banner: ''
    };
    const health = cachedHealthForGroup(group) || {
      score: 0,
      status: 'UNKNOWN',
      badges: [],
      updatedAt: null
    };
    const item = {
      id: group.primaryId,
      groupId: group.id,
      name: group.name,
      filename: group.filename,
      category: group.category,
      platform: group.platform,
      type: group.type,
      extension: group.extension,
      size: group.size,
      totalSize: group.totalSize,
      icon: group.icon || metadata.poster || null,
      version: group.version || null,
      releaseGroup: group.releaseGroup || null,
      crackStatus: group.crackStatus || 'Unknown',
      tags: group.tags,
      updatedAt: group.updatedAt,
      partCount: group.items.length,
      health: shortHealth(health),
      screenshots: (metadata.screenshots || []).slice(0, 4),
      banner: metadata.banner || '',
      poster: metadata.poster || group.icon || ''
    };
    return PUBLIC_GROUP_FIELDS.reduce((out, key) => {
      out[key] = item[key] ?? null;
      return out;
    }, {});
  }

  function detailsForId(id) {
    const group = groupForId(id);
    if (!group) return null;
    const metadata = getMetadata(group);
    const health = getHealth(group.id);
    const mirrors = mirrorsForGroup(group);
    const screenshots = galleryFromMetadata(metadata, group);
    const archiveParts = archivePartsForGroup(group);

    return {
      id: group.primaryId,
      groupId: group.id,
      title: metadata.title || group.name,
      version: group.version || metadata.version || 'Unknown',
      category: group.category,
      platform: group.platform,
      type: group.type,
      totalSize: group.totalSize,
      totalSizeLabel: sizeLabel(group.totalSize),
      screenshots,
      banner: metadata.banner || screenshots[0] || '',
      poster: metadata.poster || group.icon || '',
      description: metadata.description,
      releaseGroup: group.releaseGroup || 'Unknown',
      crackStatus: group.crackStatus || 'Unknown',
      installGuide: inferInstallGuide(group),
      minimumSpecs: metadata.minimumSpecs || [],
      recommendedSpecs: metadata.recommendedSpecs || [],
      fileHealth: health,
      uploadDate: group.primary?.addedAt || null,
      updatedAt: group.updatedAt,
      archiveParts,
      downloadMirrors: mirrors,
      manifestUrl: `/api/downloads/manifest/${encodeURIComponent(group.primaryId)}.m3u8`,
      relatedTitles: relatedForGroup(group),
      tags: Array.from(new Set([...(group.tags || []), ...(metadata.genres || [])])).slice(0, 16),
      metadata: {
        source: metadata.source,
        providers: metadata.providers || [],
        developers: metadata.developers || [],
        publishers: metadata.publishers || [],
        releaseDate: metadata.releaseDate || null,
        rating: metadata.rating || null
      }
    };
  }

  function specsForId(id) {
    const details = detailsForId(id);
    if (!details) return null;
    return {
      id: details.id,
      minimum: details.minimumSpecs,
      recommended: details.recommendedSpecs,
      metadata: details.metadata
    };
  }

  function manifestForId(id) {
    const group = groupForId(id);
    if (!group) return null;
    const mirrors = mirrorsForGroup(group);
    const lines = [
      '#EXTM3U',
      '#EXT-X-VERSION:3',
      `#STREAMVAULT-TITLE:${group.name}`,
      `#STREAMVAULT-GROUP:${group.id}`,
      `#STREAMVAULT-PARTS:${mirrors.length}`
    ];
    mirrors.forEach((mirror, index) => {
      lines.push(`#EXTINF:${mirror.size || 0},${mirror.filename || `Part ${index + 1}`}`);
      lines.push(mirror.url);
    });
    lines.push('#EXT-X-ENDLIST');
    return lines.join('\n');
  }

  function getPublicItems() {
    loadCatalog();
    return state.groups.map(publicGroupItem);
  }

  function startBackgroundScan() {
    const delay = parseInt(process.env.DOWNLOAD_HEALTH_BOOT_DELAY || '2500', 10);
    setTimeout(() => queueStaleHealthScans(), Number.isFinite(delay) ? delay : 2500);
  }

  return {
    loadCatalog,
    getPublicItems,
    getDownloadItem: itemForId,
    getDetails: detailsForId,
    getHealth,
    getScreenshots(id) {
      const details = detailsForId(id);
      return details ? { id: details.id, screenshots: details.screenshots, banner: details.banner, poster: details.poster } : null;
    },
    getSpecs: specsForId,
    getMirrors(id) {
      const group = groupForId(id);
      return group ? { id: group.primaryId, groupId: group.id, mirrors: mirrorsForGroup(group) } : null;
    },
    getManifest: manifestForId,
    rebuildHealthCache,
    scanStatus,
    startBackgroundScan,
    DOWNLOAD_ID_RE
  };
}

module.exports = { createDownloadPlatform };

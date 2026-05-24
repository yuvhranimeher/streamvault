const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const IGNORED_EXTS = new Set([
  'jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg',
  'nfo', 'sfv', 'md5', 'sha1', 'sha256', 'txt', 'url', 'ini'
]);
const ARCHIVE_EXTS = new Set(['zip', 'rar', '7z']);
const INSTALLER_EXTS = new Set(['exe', 'msi', 'apk', 'xapk', 'apks', 'dmg', 'pkg']);
const DISK_EXTS = new Set(['iso', 'img']);
const CONSOLE_EXTS = new Set(['nsp', 'xci', 'cia', '3ds', 'gba', 'nds', 'nes', 'snes', 'wbfs', 'rvz', 'wad']);
const RELEASE_WORDS = [
  'dodi', 'fitgirl', 'repack', 'repacked', 'x264', 'x265', 'h264', 'h265', 'hevc',
  'multi', 'multilang', 'gog', 'drm free', 'drm-free', 'codex', 'cpy', 'plaza',
  'skidrow', 'reloaded', 'rune', 'flt', 'elamigos', 'nosteam', 'steamrip',
  'kaos', 'xatab', 'rg mechanics', 'black box', 'corepack'
];
const POSTER_EXTS = ['.webp', '.jpg', '.jpeg', '.png'];

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

function urlPath(value) {
  try {
    return safeDecode(new URL(String(value || '')).pathname);
  } catch {
    return safeDecode(stripQuery(value));
  }
}

function urlOrigin(value) {
  try {
    return new URL(String(value || '')).origin;
  } catch {
    return '';
  }
}

function extensionOf(value) {
  return path.extname(stripQuery(value)).replace('.', '').toLowerCase();
}

function filenameOf(item) {
  const fromFile = safeDecode(item?.filename || '').trim();
  if (fromFile) return fromFile;
  const sourcePath = urlPath(item?.url || item?.downloadUrl || '');
  return safeDecode(path.posix.basename(sourcePath));
}

function parentFolderKey(item) {
  const sourcePath = urlPath(item?.url || item?.downloadUrl || '');
  const dir = path.posix.dirname(sourcePath || '');
  const origin = urlOrigin(item?.url || item?.downloadUrl || '');
  return `${origin}${dir}`.replace(/\/+$/, '');
}

function parentFolderTitle(item) {
  const sourcePath = urlPath(item?.url || item?.downloadUrl || '');
  const dir = path.posix.dirname(sourcePath || '');
  const base = path.posix.basename(dir);
  return base && base !== '.' ? base : filenameOf(item);
}

function pathParts(item) {
  return urlPath(item?.url || item?.downloadUrl || '')
    .split('/')
    .map(part => safeDecode(part).trim())
    .filter(Boolean);
}

function titleCase(value) {
  return String(value || '').replace(/\b([a-z])([a-z']*)/g, (_, a, b) => `${a.toUpperCase()}${b}`);
}

function cleanTitle(value) {
  let text = safeDecode(value || '')
    .replace(/\.[A-Za-z0-9]{1,8}$/g, ' ')
    .replace(/[_]+/g, ' ')
    .replace(/[.]+/g, ' ')
    .replace(/\s*[-–—]\s*/g, ' ')
    .replace(/\[[^\]]*]/g, ' ')
    .replace(/\{[^}]*}/g, ' ')
    .replace(/\([^)]*(?:pc|repack|fitgirl|dodi|multi|gog|drm|x64|x86|crack|update|hotfix)[^)]*\)/ig, ' ')
    .replace(/\((\s*)\)/g, ' ');

  RELEASE_WORDS.forEach(word => {
    const pattern = new RegExp(`\\b${word.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'ig');
    text = text.replace(pattern, ' ');
  });

  text = text
    .replace(/\bv(?:ersion)?\s*\d+(?:\.\d+){0,5}[a-z0-9-]*\b/ig, ' ')
    .replace(/\bbuild\s*\d+\b/ig, ' ')
    .replace(/\bupdate\s*\d+\b/ig, ' ')
    .replace(/\bpart\s*\d{1,4}\b/ig, ' ')
    .replace(/\.part\d{1,4}\b/ig, ' ')
    .replace(/\bcd\s*\d{1,2}\b/ig, ' ')
    .replace(/\b(?:x86|x64|win64|win32|portable|setup|installer|cracked|crackfix)\b/ig, ' ')
    .replace(/^[\s\-–—]+|[\s\-–—]+$/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return titleCase(text || 'Untitled Software');
}

function normalizedTokens(value) {
  const cleaned = cleanTitle(value).toLowerCase();
  return cleaned
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 2 && !['the', 'and', 'for', 'with'].includes(token));
}

function normalizePosterName(value) {
  return cleanTitle(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/['’]/g, '')
    .replace(/\b(?:ps[1-5]|psp|xbox(?:360|one)?|xbox360|switch|nintendo switch|android|apk|xapk|apks|obb|data|mod)\b/g, ' ')
    .replace(/\b(?:dodi|fitgirl|nosteam|steamrip|goldberg|elamigos|gog|codex|cpy|plaza|skidrow|reloaded|rune|duplex|complex|imars|opoisso|kbis)\b/g, ' ')
    .replace(/\b(?:deluxe|definitive|ultimate|complete|anniversary|remastered|edition|collection|directors cut|director s cut)\b/g, ' ')
    .replace(/\b(?:19|20)\d{2}\b/g, ' ')
    .replace(/\bv?\d+(?:[._-]\d+){0,5}[a-z]?\b/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function posterFolderFor(category, platform) {
  const text = `${category || ''} ${platform || ''}`.toLowerCase();
  return text.includes('game') ? 'games' : 'software';
}

function createSoftwarePostersMap(rootDir = process.cwd()) {
  const publicDir = path.join(rootDir, 'public');
  const posterRoot = path.join(publicDir, 'posters');
  const folders = ['games', 'software'];
  const map = {};
  const byFolder = {};
  let total = 0;

  folders.forEach(folder => {
    byFolder[folder] = {};
    const dir = path.join(posterRoot, folder);
    if (!fs.existsSync(dir)) return;
    const stack = [dir];
    while (stack.length) {
      const current = stack.pop();
      let entries = [];
      try { entries = fs.readdirSync(current, { withFileTypes: true }); } catch { entries = []; }
      entries.forEach(entry => {
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) {
          stack.push(full);
          return;
        }
        const ext = path.extname(entry.name).toLowerCase();
        if (!POSTER_EXTS.includes(ext)) return;
        const slug = path.basename(entry.name, ext).toLowerCase();
        const rel = `/posters/${folder}/${path.relative(dir, full).replace(/\\/g, '/')}`;
        byFolder[folder][slug] = rel;
        map[`${folder}:${slug}`] = rel;
        const normalizedSlug = normalizePosterName(slug);
        if (normalizedSlug && !byFolder[folder][normalizedSlug]) {
          byFolder[folder][normalizedSlug] = rel;
          map[`${folder}:${normalizedSlug}`] = rel;
        }
        total += 1;
      });
    }
  });

  return { map, byFolder, total, generatedAt: new Date().toISOString() };
}

function resolveLocalPoster(title, category, platform, postersMap) {
  const slug = normalizePosterName(title);
  if (!slug) return '';
  const folder = posterFolderFor(category, platform);
  const byFolder = postersMap?.byFolder || {};
  return byFolder[folder]?.[slug] || byFolder.games?.[slug] || byFolder.software?.[slug] || '';
}

function detectMultipart(name) {
  const lower = String(name || '').toLowerCase();
  let match = lower.match(/(?:^|[.\s_-])part\s*0*(\d{1,4})(?=[.\s_-]|$)/i);
  if (match) return { kind: 'part', number: Number(match[1]) };
  match = lower.match(/\.r(\d{2,3})$/i);
  if (match) return { kind: 'rar-series', number: Number(match[1]) + 2 };
  match = lower.match(/\.(\d{3})$/i);
  if (match) return { kind: 'numeric-series', number: Number(match[1]) };
  match = lower.match(/(?:^|[.\s_-])cd\s*0*(\d{1,2})(?=[.\s_-]|$)/i);
  if (match) return { kind: 'disc', number: Number(match[1]) };
  if (/\.rar$/i.test(lower) && !/\.part\d+\.rar$/i.test(lower)) return { kind: 'part', number: 1 };
  return { kind: '', number: 0 };
}

function detectCategory(item, ext, parts) {
  const text = [
    item?.category,
    item?.platform,
    item?.name,
    item?.filename,
    ...parts
  ].filter(Boolean).join(' ').toLowerCase();

  if (/\b(tutorial|course|training|learn|udemy)\b/.test(text)) return 'Tutorials';
  if (['apk', 'xapk', 'apks'].includes(ext) || /\b(android|apk|xapk|apks)\b/.test(text)) return 'Android APK';
  if (CONSOLE_EXTS.has(ext) || /\b(console|switch|nintendo|playstation|ps2|ps3|ps4|ps5|xbox|wii|3ds)\b/.test(text)) return 'Console Games';
  if (DISK_EXTS.has(ext) && /\b(os|windows|linux|ubuntu|debian|fedora|macos|boot|image)\b/.test(text)) return 'OS Images';
  if (/\b(pc games?|games?)\b/.test(text)) return 'PC Games';
  if (INSTALLER_EXTS.has(ext) || /\b(software|apps?|tools?|utilities|portable)\b/.test(text)) return 'Software';
  if (DISK_EXTS.has(ext)) return 'OS Images';
  return 'Software';
}

function detectPlatform(ext, category, parts) {
  const text = parts.join(' ').toLowerCase();
  if (['apk', 'xapk', 'apks'].includes(ext)) return 'Android';
  if (category === 'Console Games') return 'Console';
  if (category === 'OS Images') return 'OS';
  if (['exe', 'msi'].includes(ext)) return 'Windows';
  if (['dmg', 'pkg'].includes(ext)) return 'macOS';
  if (DISK_EXTS.has(ext)) return 'OS';
  if (CONSOLE_EXTS.has(ext)) return 'Console';
  if (/\b(android)\b/.test(text)) return 'Android';
  if (/\b(mac|macos|osx)\b/.test(text)) return 'macOS';
  if (String(category).includes('PC Games')) return 'Windows';
  return 'Multi-platform';
}

function fileSortValue(file) {
  if (/setup|install/i.test(file.name) && ['exe', 'msi'].includes(file.extension)) return -20;
  if (file.partNumber) return file.partNumber;
  if (ARCHIVE_EXTS.has(file.extension)) return 1000;
  return 2000;
}

function formatSize(size) {
  const n = Number(size);
  if (!Number.isFinite(n) || n <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = n;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value >= 10 || index === 0 ? Math.round(value) : value.toFixed(1)} ${units[index]}`;
}

function iconKindFor(category, platform) {
  if (category === 'PC Games') return 'game';
  if (category === 'Android APK' || platform === 'Android') return 'android';
  if (category === 'OS Images' || platform === 'OS') return 'os';
  if (category === 'Console Games' || platform === 'Console') return 'console';
  if (category === 'Tutorials') return 'tutorial';
  return 'software';
}

function healthFor(files) {
  const archiveFiles = files.filter(file => ARCHIVE_EXTS.has(file.extension));
  const multipartFiles = files.filter(file => file.partNumber > 0 && (ARCHIVE_EXTS.has(file.extension) || INSTALLER_EXTS.has(file.extension)));
  const installerFiles = files.filter(file =>
    INSTALLER_EXTS.has(file.extension) ||
    DISK_EXTS.has(file.extension) ||
    /(^|[.\s_-])(setup|install|installer)([.\s_-]|$)/i.test(file.name)
  );
  const partNumbers = multipartFiles
    .map(file => file.partNumber)
    .filter(number => Number.isInteger(number) && number > 0);
  const uniqueParts = Array.from(new Set(partNumbers)).sort((a, b) => a - b);
  const expectedMax = uniqueParts.length ? Math.max(...uniqueParts) : 0;
  const missing = [];
  if (expectedMax > 1) {
    for (let i = 1; i <= expectedMax; i += 1) {
      if (!uniqueParts.includes(i)) missing.push(i);
    }
  }

  const badges = [];
  const issues = [];
  if (archiveFiles.length) badges.push(`${archiveFiles.length} archive file${archiveFiles.length === 1 ? '' : 's'}`);
  if (uniqueParts.length > 1) badges.push(`${uniqueParts.length} archive part${uniqueParts.length === 1 ? '' : 's'}`);
  if (installerFiles.length) badges.push('Installer present');

  if (missing.length) {
    issues.push(`Missing archive part${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 20).join(', ')}`);
    return { status: 'Incomplete', badges, issues, warnings: [] };
  }
  if (installerFiles.length) return { status: 'Verified', badges, issues: [], warnings: [] };
  if (uniqueParts.length > 1) return { status: 'Verified', badges, issues: [], warnings: ['Installer may be inside the extracted archive.'] };
  if (archiveFiles.length && archiveFiles.length === files.length) {
    return { status: 'Archive Only', badges, issues: [], warnings: ['Only compressed files are visible in the catalog.'] };
  }
  if (archiveFiles.length) {
    return { status: 'Missing Setup', badges, issues: ['Archive exists, but no setup/install file was indexed beside it.'], warnings: [] };
  }
  return { status: 'Unknown', badges, issues: [], warnings: ['No installer or archive structure was detected.'] };
}

function installGuideFor(pkg) {
  const hasMultipart = pkg.files.some(file => file.partNumber > 1);
  const hasArchive = pkg.files.some(file => ARCHIVE_EXTS.has(file.extension));
  const hasAndroid = pkg.platform === 'Android';
  if (hasAndroid) {
    return [
      'Download the APK, XAPK, or APKS file.',
      'Keep split package files together if more than one file is listed.',
      'Install with your preferred Android package installer.',
      'Only install files from sources you trust.'
    ];
  }
  if (hasMultipart) {
    return [
      'Download all archive parts.',
      'Keep every part in the same folder.',
      'Extract part 1 only; the extractor will read the rest automatically.',
      'Run setup or install if it appears after extraction.'
    ];
  }
  if (hasArchive) {
    return [
      'Download the archive file.',
      'Extract it to a local folder.',
      'Run setup or install if it appears after extraction.'
    ];
  }
  return [
    'Download the installer file.',
    'Run setup or install from your local downloads folder.',
    'Follow the installer prompts.'
  ];
}

function makeFile(raw, index) {
  const filename = filenameOf(raw);
  const ext = String(raw.extension || extensionOf(filename) || extensionOf(raw.url)).toLowerCase();
  if (!filename || filename.toLowerCase() === 'desktop.ini' || IGNORED_EXTS.has(ext)) return null;
  const multipart = detectMultipart(filename);
  const sourceUrl = raw.url || raw.downloadUrl || '';
  const id = `sf_${hash(`${sourceUrl}|${filename}`, 18)}`;
  return {
    id,
    name: safeDecode(filename),
    filename: safeDecode(filename),
    url: sourceUrl,
    downloadUrl: sourceUrl,
    extension: ext || 'file',
    size: Number(raw.size || raw.bytes || raw.length || 0) || 0,
    sizeLabel: formatSize(raw.size || raw.bytes || raw.length),
    partNumber: multipart.number || 0,
    partKind: multipart.kind || '',
    addedAt: raw.addedAt || raw.updatedAt || raw.createdAt || ''
  };
}

function buildPackage(groupKey, rawItems) {
  const first = rawItems[0] || {};
  const files = rawItems
    .map(makeFile)
    .filter(Boolean)
    .reduce((unique, file) => {
      const key = `${file.downloadUrl || file.url}|${file.name}`.toLowerCase();
      if (!unique.has(key)) unique.set(key, file);
      return unique;
    }, new Map());
  const byPart = new Map();
  Array.from(files.values()).forEach(file => {
    const key = file.partNumber > 0 && (ARCHIVE_EXTS.has(file.extension) || INSTALLER_EXTS.has(file.extension))
      ? `part:${file.extension}:${file.partNumber}`
      : `file:${file.id}`;
    const existing = byPart.get(key);
    if (!existing || (/\(\d+\)/.test(existing.name) && !/\(\d+\)/.test(file.name))) byPart.set(key, file);
  });
  const sortedFiles = Array.from(byPart.values())
    .sort((a, b) => fileSortValue(a) - fileSortValue(b) || a.name.localeCompare(b.name));
  if (!sortedFiles.length) return null;

  const parts = pathParts(first);
  const categoryVotes = new Map();
  const platformVotes = new Map();
  sortedFiles.forEach(file => {
    const category = detectCategory(first, file.extension, parts);
    const platform = detectPlatform(file.extension, category, parts);
    categoryVotes.set(category, (categoryVotes.get(category) || 0) + 1);
    platformVotes.set(platform, (platformVotes.get(platform) || 0) + 1);
  });

  const category = Array.from(categoryVotes.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Software';
  const platform = Array.from(platformVotes.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || detectPlatform(files[0].extension, category, parts);
  const title = cleanTitle(parentFolderTitle(first));
  const totalSize = sortedFiles.reduce((sum, file) => sum + (Number(file.size) || 0), 0);
  const health = healthFor(sortedFiles);
  const archivePartCount = new Set(sortedFiles.map(file => file.partNumber).filter(Boolean)).size || sortedFiles.filter(file => ARCHIVE_EXTS.has(file.extension)).length;
  const tags = Array.from(new Set([
    category,
    platform,
    health.status,
    archivePartCount > 1 ? 'Multipart' : '',
    sortedFiles.some(file => INSTALLER_EXTS.has(file.extension)) ? 'Installer' : ''
  ].filter(Boolean)));

  const id = `sw_${hash(groupKey, 18)}`;
  const posterSlug = normalizePosterName(title);
  const posterFolder = posterFolderFor(category, platform);
  const generatedPosterPath = posterSlug ? `/posters/${posterFolder}/${posterSlug}.webp` : '';
  const packageData = {
    id,
    title,
    name: title,
    category,
    platform,
    totalSize,
    totalSizeLabel: formatSize(totalSize),
    fileCount: sortedFiles.length,
    archiveParts: archivePartCount,
    partCount: archivePartCount,
    iconKind: iconKindFor(category, platform),
    health,
    fileHealth: health,
    updatedAt: sortedFiles.map(file => file.addedAt).filter(Boolean).sort().pop() || first.addedAt || '',
    tags,
    files: sortedFiles,
    installGuide: [],
    relatedTitles: [],
    searchText: '',
    posterSlug,
    posterFolder,
    generatedPosterPath,
    poster: '',
    posterUrl: ''
  };
  packageData.installGuide = installGuideFor(packageData);
  packageData.searchText = normalizedTokens([title, category, platform, tags.join(' ')].join(' ')).join(' ');
  return packageData;
}

function relatedFor(pkg, allPackages) {
  const own = new Set(normalizedTokens(pkg.title));
  const scored = [];
  allPackages.forEach(other => {
    if (other.id === pkg.id || other.category !== pkg.category) return;
    const tokens = normalizedTokens(other.title);
    let score = other.platform === pkg.platform ? 2 : 0;
    tokens.forEach(token => { if (own.has(token)) score += 3; });
    if (score > 0) scored.push({ score, other });
  });
  return scored
    .sort((a, b) => b.score - a.score || a.other.title.localeCompare(b.other.title))
    .slice(0, 12)
    .map(({ other }) => ({
      id: other.id,
      title: other.title,
      name: other.title,
      category: other.category,
      platform: other.platform,
      iconKind: other.iconKind,
      health: other.health,
      totalSize: other.totalSize
    }));
}

function publicItem(pkg) {
  return {
    id: pkg.id,
    title: pkg.title,
    name: pkg.title,
    category: pkg.category,
    platform: pkg.platform,
    totalSize: pkg.totalSize,
    totalSizeLabel: pkg.totalSizeLabel,
    fileCount: pkg.fileCount,
    archiveParts: pkg.archiveParts,
    partCount: pkg.partCount,
    iconKind: pkg.iconKind,
    health: pkg.health,
    updatedAt: pkg.updatedAt,
    tags: pkg.tags,
    poster: pkg.poster || pkg.localPoster || '',
    posterUrl: pkg.posterUrl || '',
    localPoster: pkg.localPoster || '',
    generatedPosterPath: pkg.generatedPosterPath || '',
    posterSlug: pkg.posterSlug || normalizePosterName(pkg.title),
    posterFolder: pkg.posterFolder || posterFolderFor(pkg.category, pkg.platform)
  };
}

function matchesFilter(pkg, filter) {
  const key = String(filter || 'All').toLowerCase();
  if (!key || key === 'all') return true;
  const platform = String(pkg.platform || '').toLowerCase();
  const category = String(pkg.category || '').toLowerCase();
  const health = String(pkg.health?.status || '').toLowerCase();
  if (key === 'windows') return platform.includes('windows');
  if (key === 'android') return platform.includes('android');
  if (key === 'games') return category.includes('game') && !platform.includes('console');
  if (key === 'console') return platform.includes('console') || category.includes('console');
  if (key === 'os') return platform === 'os' || category.includes('os');
  if (key === 'archives') return pkg.archiveParts > 0;
  if (key === 'verified') return health === 'verified';
  return true;
}

function matchesQuery(pkg, query) {
  const terms = String(query || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const text = [
    pkg.title,
    pkg.category,
    pkg.platform,
    ...(Array.isArray(pkg.tags) ? pkg.tags : [])
  ].filter(Boolean).join(' ').toLowerCase();
  return terms.every(term => text.includes(term));
}

function detailItem(pkg) {
  return {
    ...publicItem(pkg),
    description: '',
    fileHealth: pkg.fileHealth || pkg.health,
    files: pkg.files,
    archiveParts: pkg.files,
    downloadMirrors: pkg.files,
    installGuide: pkg.installGuide,
    relatedTitles: pkg.relatedTitles,
    manifestUrl: '',
    poster: pkg.poster || pkg.localPoster || '',
    posterUrl: pkg.posterUrl || '',
    localPoster: pkg.localPoster || '',
    generatedPosterPath: pkg.generatedPosterPath || '',
    posterSlug: pkg.posterSlug || normalizePosterName(pkg.title),
    posterFolder: pkg.posterFolder || posterFolderFor(pkg.category, pkg.platform)
  };
}

function applySoftwarePosters(library, rootDir = process.cwd()) {
  const postersMap = createSoftwarePostersMap(rootDir);
  const packages = Array.isArray(library?.packages) ? library.packages : [];
  let matched = 0;
  let missing = 0;
  packages.forEach(pkg => {
    const slug = normalizePosterName(pkg.title || pkg.name);
    const folder = pkg.posterFolder || posterFolderFor(pkg.category, pkg.platform);
    const generatedPosterPath = slug ? `/posters/${folder}/${slug}.webp` : '';
    const localPoster = resolveLocalPoster(pkg.title || pkg.name, pkg.category, pkg.platform, postersMap);
    pkg.posterSlug = slug;
    pkg.posterFolder = folder;
    pkg.generatedPosterPath = generatedPosterPath;
    pkg.localPoster = localPoster;
    if (localPoster) {
      pkg.poster = localPoster;
      pkg.posterUrl = pkg.posterUrl || localPoster;
      matched += 1;
    } else {
      if (!pkg.poster || /^\/posters\//i.test(String(pkg.poster))) pkg.poster = '';
      if (!pkg.posterUrl || /^\/posters\//i.test(String(pkg.posterUrl))) pkg.posterUrl = '';
      missing += 1;
    }
  });
  library.posterStats = { matched, missing, available: postersMap.total, generatedAt: postersMap.generatedAt };
  return { library, postersMap, matched, missing };
}

function catalogEntries(raw) {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw.downloads)) return raw.downloads;
  if (Array.isArray(raw.items)) return raw.items;
  if (Array.isArray(raw.files)) return raw.files;
  return [];
}

function buildSoftwareLibrary(inputFile, outputFile, options = {}) {
  const raw = loadJSON(inputFile, {});
  const rootDir = options.rootDir || path.dirname(outputFile || inputFile || process.cwd());
  const entries = catalogEntries(raw);
  const groups = new Map();
  entries.forEach((entry, index) => {
    const file = makeFile(entry, index);
    if (!file) return;
    const key = parentFolderKey(entry) || cleanTitle(entry.name || entry.filename || file.name);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  });

  const packages = Array.from(groups.entries())
    .map(([key, items]) => buildPackage(key, items))
    .filter(Boolean)
    .sort((a, b) => a.title.localeCompare(b.title));

  packages.forEach(pkg => {
    pkg.relatedTitles = relatedFor(pkg, packages);
  });

  let output = {
    generatedAt: new Date().toISOString(),
    source: path.basename(inputFile),
    total: packages.length,
    files: packages.reduce((sum, pkg) => sum + pkg.fileCount, 0),
    packages
  };
  output = applySoftwarePosters(output, rootDir).library;
  writeJSONAtomic(outputFile, output);
  return output;
}

function createSoftwareLibrary(options = {}) {
  const rootDir = options.rootDir || process.cwd();
  const catalogsDir = path.join(rootDir, 'data', 'catalogs');
  const libraryFile = options.libraryFile || path.join(catalogsDir, 'software-library.json');
  const inputFile = options.inputFile || path.join(catalogsDir, 'software-catalog.json');
  const fallbackInputFile = options.fallbackInputFile || path.join(catalogsDir, 'downloads-catalog.json');
  let library = { generatedAt: '', total: 0, packages: [] };
  let packageMap = new Map();
  let fileMap = new Map();
  let publicItems = [];
  let postersMap = createSoftwarePostersMap(rootDir);
  let posterStats = { matched: 0, missing: 0, available: postersMap.total };

  function index() {
    const applied = applySoftwarePosters(library, rootDir);
    library = applied.library;
    postersMap = applied.postersMap;
    posterStats = { matched: applied.matched, missing: applied.missing, available: postersMap.total };
    const packages = Array.isArray(library.packages) ? library.packages : [];
    packageMap = new Map();
    fileMap = new Map();
    publicItems = packages.map(pkg => {
      packageMap.set(pkg.id, pkg);
      (pkg.files || []).forEach(file => fileMap.set(file.id, { ...file, packageId: pkg.id, packageTitle: pkg.title }));
      return publicItem(pkg);
    });
  }

  function load(force = false) {
    if (force || !library.packages?.length) {
      const primary = loadJSON(inputFile, null);
      const primaryCount = primary ? catalogEntries(primary).length : 0;
      const sourceInput = primaryCount ? inputFile : fallbackInputFile;
      if ((!fs.existsSync(libraryFile) || !loadJSON(libraryFile, {}).packages?.length) && fs.existsSync(sourceInput)) {
        buildSoftwareLibrary(sourceInput, libraryFile, { rootDir });
      }
      library = loadJSON(libraryFile, { generatedAt: '', total: 0, packages: [] });
      index();
    }
    return library;
  }

  load(false);

  return {
    load,
    list() {
      load(false);
      return publicItems;
    },
    query(options = {}) {
      load(false);
      const page = Math.max(1, Number.parseInt(options.page, 10) || 1);
      const limit = Math.max(1, Math.min(120, Number.parseInt(options.limit, 10) || 40));
      const filtered = (Array.isArray(library.packages) ? library.packages : [])
        .filter(pkg => matchesFilter(pkg, options.filter) && matchesQuery(pkg, options.q));
      const start = (page - 1) * limit;
      return {
        items: filtered.slice(start, start + limit).map(publicItem),
        total: filtered.length,
        page,
        limit,
        pages: Math.ceil(filtered.length / limit)
      };
    },
    total() {
      load(false);
      return publicItems.length;
    },
    postersMap() {
      load(false);
      return {
        generatedAt: postersMap.generatedAt,
        total: postersMap.total,
        stats: posterStats,
        map: postersMap.map
      };
    },
    posterStats() {
      load(false);
      return posterStats;
    },
    detail(id) {
      load(false);
      const pkg = packageMap.get(String(id || ''));
      return pkg ? detailItem(pkg) : null;
    },
    getFile(id) {
      load(false);
      const file = fileMap.get(String(id || ''));
      if (!file) return null;
      return {
        id: file.id,
        name: file.name,
        filename: file.filename,
        downloadUrl: file.downloadUrl || file.url,
        packageId: file.packageId,
        packageTitle: file.packageTitle
      };
    },
    rebuild() {
      const primary = loadJSON(inputFile, null);
      const sourceInput = primary && catalogEntries(primary).length ? inputFile : fallbackInputFile;
      library = buildSoftwareLibrary(sourceInput, libraryFile, { rootDir });
      index();
      return { ok: true, total: publicItems.length, generatedAt: library.generatedAt };
    }
  };
}

module.exports = {
  buildSoftwareLibrary,
  createSoftwareLibrary,
  createSoftwarePostersMap,
  applySoftwarePosters,
  normalizePosterName,
  normalizeSoftwareTitle: cleanTitle,
  cleanTitle,
  detectMultipart,
  healthFor
};

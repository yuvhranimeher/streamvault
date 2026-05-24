const path = require('path');

const ARCHIVE_EXTS = new Set(['zip', 'rar', '7z']);
const INSTALLER_EXTS = new Set(['exe', 'msi', 'apk', 'xapk', 'apks', 'dmg', 'pkg']);
const EXECUTABLE_EXTS = new Set(['exe', 'bat', 'cmd', 'com', 'msi', 'apk', 'xapk', 'apks', 'dmg', 'pkg']);
const DISK_EXTS = new Set(['iso', 'img']);
const ROM_EXTS = new Set(['nsp', 'xci', 'cia', '3ds', 'gba', 'gb', 'gbc', 'nds', 'nes', 'snes', 'smc', 'sfc', 'z64', 'n64', 'wbfs', 'rvz', 'wad', 'iso']);
const IGNORED_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg', 'nfo', 'sfv', 'md5', 'sha1', 'sha256', 'txt', 'url', 'ini']);

const JUNK_WORDS = [
  'fitgirl', 'dodi', 'repack', 'repacked', 'razor1911', 'razor 1911', 'codex', 'skidrow',
  'cpy', 'plaza', 'reloaded', 'rune', 'flt', 'elamigos', 'nosteam', 'steamrip', 'gog',
  'kaos', 'xatab', 'corepack', 'blackbox', 'black box', 'rg mechanics', 'goldberg',
  'duplex', 'complex', 'imars', 'opoisso', 'kbis', 'multi', 'multilang', 'crack',
  'cracked', 'crackfix', 'no crack', 'portable', 'setup', 'installer', 'launcher backup',
  'epic games launcher backup', 'update', 'hotfix', 'proper', 'real', 'internal'
];

function safeDecode(value) {
  const text = String(value || '');
  try { return decodeURIComponent(text); } catch { return text; }
}

function titleCase(value) {
  return String(value || '').replace(/\b([a-z])([a-z']*)/g, (_, a, b) => `${a.toUpperCase()}${b}`);
}

function extensionOf(value) {
  return path.extname(String(value || '').split(/[?#]/)[0]).replace('.', '').toLowerCase();
}

function filenameFromUrl(value) {
  try {
    return safeDecode(path.posix.basename(new URL(String(value || '')).pathname));
  } catch {
    return safeDecode(path.posix.basename(String(value || '').split(/[?#]/)[0]));
  }
}

function filenameOf(item) {
  return safeDecode(item?.filename || item?.name || filenameFromUrl(item?.downloadUrl || item?.url || '')).trim();
}

function normalizeTitle(value) {
  let text = safeDecode(value || '')
    .replace(/\.[a-z0-9]{1,8}$/ig, ' ')
    .replace(/[._]+/g, ' ')
    .replace(/\[[^\]]*]/g, ' ')
    .replace(/\{[^}]*}/g, ' ')
    .replace(/\((?:[^)]*(?:pc|repack|fitgirl|dodi|nosteam|steamrip|gog|codex|skidrow|razor|crack|x64|x86|multi|apk|android|switch|ps[1-5])[^)]*)\)/ig, ' ')
    .replace(/\bpart\s*0*\d{1,4}\b/ig, ' ')
    .replace(/\.part0*\d{1,4}\b/ig, ' ')
    .replace(/\bcd\s*0*\d{1,2}\b/ig, ' ')
    .replace(/\br\d{2,3}\b/ig, ' ')
    .replace(/\b(?:19|20)\d{2}\b/g, ' ')
    .replace(/\bv(?:ersion)?\s*\d+(?:[._-]\d+){0,5}[a-z0-9-]*\b/ig, ' ')
    .replace(/\bbuild\s*\d+\b/ig, ' ');

  JUNK_WORDS.forEach(word => {
    text = text.replace(new RegExp(`\\b${word.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'ig'), ' ');
  });

  text = text
    .replace(/\b(?:pc|game|games|software|windows|android|apk|obb|data|x64|x86|win64|win32)\b/ig, ' ')
    .replace(/[^a-z0-9]+/ig, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return titleCase(text || 'Untitled Software');
}

function normalizedKey(value) {
  return normalizeTitle(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function detectMultipart(filename) {
  const lower = String(filename || '').toLowerCase();
  let match = lower.match(/(?:^|[.\s_-])part\s*0*(\d{1,4})(?=[.\s_-]|$)/i) || lower.match(/\.part0*(\d{1,4})\./i);
  if (match) return { kind: 'part', number: Number(match[1]) };
  match = lower.match(/\.r(\d{2,3})$/i);
  if (match) return { kind: 'rar-series', number: Number(match[1]) + 2 };
  match = lower.match(/\.(\d{3})$/i);
  if (match) return { kind: 'numeric-series', number: Number(match[1]) };
  return { kind: '', number: 0 };
}

function detectCategory(item, files = []) {
  const text = [item?.category, item?.platform, item?.type, item?.title, item?.name, item?.filename, files.map(f => f.filename || f.name).join(' ')].join(' ').toLowerCase();
  const exts = new Set(files.map(file => file.extension).filter(Boolean));
  if (/\b(tutorial|course|training|learn|udemy)\b/.test(text)) return 'Tutorials';
  if ([...exts].some(ext => ['apk', 'xapk', 'apks'].includes(ext)) || /\b(android|apk|xapk|apks)\b/.test(text)) return 'Android';
  if ([...exts].some(ext => ROM_EXTS.has(ext)) || /\b(console|switch|nintendo|playstation|ps[1-5]|xbox|wii|3ds|roms?)\b/.test(text)) return 'Console';
  if ([...exts].some(ext => DISK_EXTS.has(ext)) && /\b(os|windows|linux|ubuntu|debian|fedora|boot|image)\b/.test(text)) return 'OS';
  if (/\b(pc games?|games?)\b/.test(text)) return 'PC Games';
  if ([...exts].every(ext => ARCHIVE_EXTS.has(ext))) return 'Archive';
  if (/\b(emulator|emu|retroarch|yuzu|ryujinx|pcsx|ppsspp|dolphin)\b/.test(text)) return 'Emulators';
  return 'Utilities';
}

function detectPlatform(item, category, files = []) {
  const text = [item?.platform, item?.category, item?.title, item?.name, item?.filename].join(' ').toLowerCase();
  const exts = new Set(files.map(file => file.extension).filter(Boolean));
  if (category === 'Android' || [...exts].some(ext => ['apk', 'xapk', 'apks'].includes(ext))) return 'Android';
  if (category === 'Console') return 'Console';
  if (category === 'OS') return 'OS';
  if ([...exts].some(ext => ['dmg', 'pkg'].includes(ext))) return 'macOS';
  if (/\b(android)\b/.test(text)) return 'Android';
  if (/\b(mac|macos|osx)\b/.test(text)) return 'macOS';
  return 'Windows';
}

function normalizeFile(raw, index = 0, fallback = {}) {
  const filename = filenameOf(raw);
  const extension = String(raw?.extension || extensionOf(filename) || extensionOf(raw?.downloadUrl || raw?.url)).toLowerCase();
  if (!filename || filename.toLowerCase() === 'desktop.ini' || IGNORED_EXTS.has(extension)) return null;
  const multipart = detectMultipart(filename);
  const url = raw?.downloadUrl || raw?.url || fallback.downloadUrl || fallback.url || '';
  return {
    id: String(raw?.id || fallback.id || `sf_${index}`),
    name: filename,
    filename,
    downloadUrl: url,
    url,
    extension: extension || 'file',
    size: Number(raw?.size || raw?.bytes || raw?.length || fallback.size || 0) || 0,
    sizeLabel: raw?.sizeLabel || '',
    partNumber: multipart.number || Number(raw?.partNumber || 0) || 0,
    partKind: multipart.kind || raw?.partKind || ''
  };
}

function analyzeFiles(files = []) {
  const clean = files.filter(Boolean);
  const archives = clean.filter(file => ARCHIVE_EXTS.has(file.extension));
  const compressed = clean.filter(file => ARCHIVE_EXTS.has(file.extension));
  const executables = clean.filter(file => EXECUTABLE_EXTS.has(file.extension));
  const installers = clean.filter(file =>
    INSTALLER_EXTS.has(file.extension) ||
    DISK_EXTS.has(file.extension) ||
    /(^|[.\s_-])(setup|install|installer)([.\s_-]|$)/i.test(file.name || file.filename)
  );
  const isoImages = clean.filter(file => DISK_EXTS.has(file.extension));
  const roms = clean.filter(file => ROM_EXTS.has(file.extension));
  const multipart = clean.filter(file => file.partNumber > 0 && (ARCHIVE_EXTS.has(file.extension) || INSTALLER_EXTS.has(file.extension)));
  const numbers = Array.from(new Set(multipart.map(file => file.partNumber).filter(n => Number.isInteger(n) && n > 0))).sort((a, b) => a - b);
  const missingParts = [];
  if (numbers.length) {
    const max = Math.max(...numbers);
    for (let i = 1; i <= max; i += 1) {
      if (!numbers.includes(i)) missingParts.push(i);
    }
  }
  const orphanedPart = numbers.length === 1 && numbers[0] > 1;
  const corruptedMultipart = missingParts.length > 0 || orphanedPart;
  const archiveOnly = clean.length > 0 && clean.every(file => ARCHIVE_EXTS.has(file.extension));
  const standaloneInstaller = clean.length === 1 && installers.length === 1 && !archives.length;

  const facts = [
    numbers.length > 1 ? `${numbers.length} archive parts indexed` : '',
    installers.length ? `${installers.length} installer/launcher file${installers.length === 1 ? '' : 's'} detected` : '',
    executables.length ? `${executables.length} executable file${executables.length === 1 ? '' : 's'} detected` : '',
    isoImages.length ? `${isoImages.length} ISO/image file${isoImages.length === 1 ? '' : 's'} detected` : '',
    roms.length && roms.length === clean.length ? 'ROM collection detected' : '',
    standaloneInstaller ? 'Standalone installer detected' : ''
  ].filter(Boolean);

  const warnings = [];
  const issues = [];
  if (missingParts.length) issues.push(`Missing archive part${missingParts.length === 1 ? '' : 's'}: ${missingParts.slice(0, 20).join(', ')}`);
  if (orphanedPart) issues.push(`Single orphaned archive part detected: part ${numbers[0]}`);
  if (archiveOnly) warnings.push('Archive-only package; installer or executable may be inside the archive.');
  if (!executables.length && !isoImages.length && !roms.length) warnings.push('No executable launcher detected in indexed files.');
  if (!installers.length && !roms.length) warnings.push('No installer file detected in indexed files.');

  let status = 'WARNING';
  if (corruptedMultipart) status = 'BROKEN';
  else if ((numbers.length > 1 && !missingParts.length) || installers.length || executables.length || isoImages.length || roms.length) status = 'GOOD';
  else if (archiveOnly || warnings.length) status = 'WARNING';

  return {
    status,
    multipart: numbers.length > 0,
    multipartComplete: numbers.length > 1 && !missingParts.length,
    partNumbers: numbers,
    missingParts,
    corruptedMultipart,
    archiveOnly,
    compressedArchive: compressed.length > 0,
    executableDetected: executables.length > 0,
    installerDetected: installers.length > 0,
    standaloneInstaller,
    isoImage: isoImages.length > 0,
    romCollection: roms.length > 0 && roms.length === clean.length,
    archiveGroupingValid: !corruptedMultipart,
    badges: facts,
    warnings,
    issues
  };
}

function installGuideFor(pkg) {
  const analysis = pkg.analysis || analyzeFiles(pkg.files || []);
  if (analysis.multipart) return [
    'Download all archive parts.',
    'Keep every part in the same folder.',
    'Extract part 1 only; the extractor will read the remaining parts automatically.',
    analysis.installerDetected ? 'Run the installer after extraction.' : 'Open the extracted folder and launch the detected executable when present.'
  ];
  if (analysis.isoImage) return ['Download the ISO/image file.', 'Mount the image in the operating system.', 'Run setup.exe or the installer inside the mounted image.'];
  if (pkg.platform === 'Android') return ['Download the APK, XAPK, or APKS file.', 'Enable installs from trusted unknown sources if required.', 'Install with a compatible Android package installer.'];
  if (analysis.romCollection) return ['Download the ROM file or collection.', 'Use a compatible emulator for the detected console platform.', 'Load the ROM from the emulator library.'];
  if (analysis.archiveOnly || analysis.compressedArchive) return ['Download the archive file.', 'Extract it to a local folder.', 'Run the installer or launcher if it appears after extraction.'];
  if (analysis.standaloneInstaller || analysis.installerDetected) return ['Download the installer file.', 'Open it from your downloads folder.', 'Follow the installer prompts.'];
  return [];
}

function descriptionFor(pkg) {
  if (pkg.description && String(pkg.description).trim()) return String(pkg.description).trim();
  if (pkg.category && pkg.platform && pkg.title) {
    return `${pkg.title} is indexed as a ${pkg.category.toLowerCase()} package for ${pkg.platform}, with ${pkg.fileCount || 0} downloadable file${pkg.fileCount === 1 ? '' : 's'} available from the vault source.`;
  }
  return 'Archive package available from federated vault source.';
}

function relatedTitlesFor(pkg, allPackages, limit = 12) {
  const ownTokens = new Set(normalizedKey(pkg.title).split(/\s+/).filter(token => token.length > 2));
  const seen = new Set([String(pkg.id)]);
  const scored = [];
  allPackages.forEach(other => {
    if (!other || seen.has(String(other.id))) return;
    const titleKey = normalizedKey(other.title);
    if (!titleKey || seen.has(titleKey)) return;
    const tokens = titleKey.split(/\s+/).filter(token => token.length > 2);
    let score = 0;
    tokens.forEach(token => { if (ownTokens.has(token)) score += 5; });
    if (other.platform === pkg.platform) score += 2;
    if (other.category === pkg.category) score += 2;
    if ((pkg.tags || []).some(tag => (other.tags || []).map(String).includes(String(tag)))) score += 1;
    if (score > 0) scored.push({ score, other, titleKey });
  });
  return scored
    .sort((a, b) => b.score - a.score || a.other.title.localeCompare(b.other.title))
    .filter(entry => {
      if (seen.has(entry.titleKey)) return false;
      seen.add(entry.titleKey);
      return true;
    })
    .slice(0, limit)
    .map(({ other }) => other);
}

module.exports = {
  ARCHIVE_EXTS,
  INSTALLER_EXTS,
  EXECUTABLE_EXTS,
  DISK_EXTS,
  ROM_EXTS,
  extensionOf,
  filenameOf,
  normalizeTitle,
  normalizedKey,
  normalizeFile,
  detectMultipart,
  detectCategory,
  detectPlatform,
  analyzeFiles,
  installGuideFor,
  descriptionFor,
  relatedTitlesFor
};

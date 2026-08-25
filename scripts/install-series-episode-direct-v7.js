'use strict';

const fs = require('fs');
const path = require('path');

const MARKER = 'SV_SERIES_EPISODE_DIRECT_V7';

function install() {
  const serverPath = path.join(__dirname, '..', 'server.js');
  let source = fs.readFileSync(serverPath, 'utf8');
  if (source.includes(MARKER)) return false;

  const detailNeedle = "app.get('/api/series/detail', (req, res) => {";
  const detailAt = source.indexOf(detailNeedle);
  if (detailAt < 0) throw new Error('Could not locate /api/series/detail route');

  const markers = ['// SV_SERIES_EPISODE_DIRECT_V6', '// SV_SERIES_EPISODE_DIRECT_V5'];
  let start = -1;
  for (const marker of markers) {
    const at = source.lastIndexOf(marker, detailAt);
    if (at > start) start = at;
  }
  if (start < 0) start = source.lastIndexOf('function svDirectEpisodeKey(value) {', detailAt);
  if (start < 0) throw new Error('Could not locate installed direct episode block');

  const block = `// SV_SERIES_EPISODE_DIRECT_V7
const svDirectEpisodeResponseCacheV7 = new Map();
let svDirectEpisodeIndexV7 = null;

function svDirectEpisodeKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\\b(?:19|20)\\d{2}\\b/g, ' ')
    .replace(/\\b(?:tv\\s+(?:mini\\s+)?series|web\\s+series|mini\\s+series|series)\\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\\s+/g, ' ')
    .trim();
}

function svDirectDeepDecode(value) {
  let text = String(value || '').trim();
  for (let i = 0; i < 4 && /%[0-9a-f]{2}/i.test(text); i++) {
    try {
      const next = decodeURIComponent(text);
      if (next === text) break;
      text = next;
    } catch (_) { break; }
  }
  return text.replace(/\\+/g, ' ');
}

function svDirectGenericEpisodeTitle(value, number) {
  const text = String(value || '').trim();
  if (!text) return true;
  return /^(?:episode|ep)\\s*0*\\d+$/i.test(text)
    || /^s\\d{1,2}e\\d{1,3}$/i.test(text)
    || /^e\\d{1,3}$/i.test(text)
    || text === String(number);
}

function svDirectEpisodeDisplayTitle(raw, number, showTitle) {
  let text = svDirectDeepDecode(raw);
  if (!text) return '';
  if (/(?:https?:\\/\\/|ftp:\\/\\/|\\/|\\\\)/i.test(text)) {
    text = text.split(/[?#]/)[0].replace(/\\\\/g, '/').split('/').filter(Boolean).pop() || text;
  }
  text = svDirectDeepDecode(text)
    .replace(/\\.(?:mkv|mp4|m4v|avi|mov|webm|ts|m2ts)$/i, '')
    .replace(/[._]+/g, ' ')
    .replace(/\\s+/g, ' ')
    .trim();

  const marker = text.match(/(?:^|\\s)(?:s\\d{1,2}\\s*e\\d{1,3}|\\d{1,2}\\s*x\\s*\\d{1,3}|episode\\s*\\d{1,3}|ep\\s*\\d{1,3})(?:\\s|$)/i);
  if (marker) text = text.slice((marker.index || 0) + marker[0].length).trim();
  else if (showTitle) {
    const escaped = String(showTitle).replace(/[.*+?^{}$()|[\\]\\\\]/g, '\\\\$&');
    if (escaped) text = text.replace(new RegExp('^' + escaped + '(?:\\\\s*[-–—:]?\\\\s*)', 'i'), '').trim();
  }

  text = text
    .replace(/^\\s*(?:episode|ep|e)\\s*0*\\d+\\s*[-–—:]?\\s*/i, '')
    .replace(/^[-–—: ]+/, '')
    .replace(/\\[[^\\]]*]/g, ' ')
    .replace(/\\([^)]*(?:2160|1080|720|480|web|bluray|x26|hevc|aac|ddp|h\\.?26)[^)]*\\)/gi, ' ')
    .replace(/\\b(?:2160p|1080p|720p|480p|4k|uhd|hdr10?|dv|dolby\\s*vision|web[- ]?dl|webrip|web|bluray|brrip|bdrip|hdrip|hdtv|remux|x264|x265|h\\.?264|h\\.?265|hevc|avc|aac(?:2\\.0)?|ac3|eac3|ddp(?:5\\.1)?|dts(?:-hd)?|10bit|8bit|multi[- ]?audio|dual[- ]?audio|nf|netflix|amzn|amazon|dsnp|proper|repack|extended|uncut|rarbg|yify|yts|psa|pahe|galaxytv)\\b.*$/i, ' ')
    .replace(/[()[\\]{}]+/g, ' ')
    .replace(/\\s+/g, ' ')
    .trim();

  if (!text || svDirectGenericEpisodeTitle(text, number) || /%[0-9a-f]{2}/i.test(text)) return '';
  return text.length > 120 ? text.slice(0, 120).trim() : text;
}

function svDirectNormalizeEpisodes(show) {
  const seasonsOut = {};
  const sourceSeasons = show && show.seasons;
  const showTitle = show && (show.name || show.title) || '';

  const put = (seasonNo, rawEpisodes) => {
    let list = [];
    if (Array.isArray(rawEpisodes)) list = rawEpisodes;
    else if (rawEpisodes && Array.isArray(rawEpisodes.episodes)) list = rawEpisodes.episodes;
    else if (rawEpisodes && typeof rawEpisodes === 'object') list = Object.values(rawEpisodes);

    const normalized = list.filter(Boolean).map((raw, index) => {
      const ep = raw && typeof raw === 'object' ? raw : { url: String(raw || '') };
      const streamUrl = ep.streamUrl || ep.url || ep.src || ep.link || '';
      const streamId = ep.streamId != null ? ep.streamId : null;
      if (!streamUrl && streamId == null) return null;
      const number = Number(ep.episode || ep.number || index + 1) || index + 1;
      let displayTitle = '';
      for (const value of [ep.epTitle, ep.title, ep.name, ep.displayTitle]) {
        displayTitle = svDirectEpisodeDisplayTitle(value, number, showTitle);
        if (displayTitle) break;
      }
      if (!displayTitle) {
        for (const value of [ep.fileName, ep.filename, ep.file, ep.path, streamUrl]) {
          displayTitle = svDirectEpisodeDisplayTitle(value, number, showTitle);
          if (displayTitle) break;
        }
      }
      if (!displayTitle) displayTitle = 'Episode ' + number;
      return {
        ...ep,
        id: ep.id || ('direct_ep_' + seasonNo + '_' + index),
        name: displayTitle,
        title: displayTitle,
        epTitle: displayTitle,
        displayTitle,
        episode: number,
        season: Number(ep.season || seasonNo) || 1,
        streamUrl,
        url: streamUrl,
        streamId,
        isFtp: ep.isFtp !== false
      };
    }).filter(Boolean).sort((a, b) => a.episode - b.episode);

    if (normalized.length) seasonsOut[String(Number(seasonNo) || seasonNo || 1)] = normalized;
  };

  if (Array.isArray(sourceSeasons)) {
    sourceSeasons.forEach((seasonObj, index) => {
      const seasonNo = Number(seasonObj && (seasonObj.season ?? seasonObj.seasonNumber ?? seasonObj.number)) || index + 1;
      put(seasonNo, seasonObj);
    });
  } else if (sourceSeasons && typeof sourceSeasons === 'object') {
    Object.entries(sourceSeasons).forEach(([seasonNo, value]) => put(seasonNo, value));
  }
  return seasonsOut;
}

function svDirectBuildEpisodeIndexV7() {
  if (svDirectEpisodeIndexV7) return svDirectEpisodeIndexV7;
  const index = new Map();
  const candidates = [];
  try {
    loadMassiveCatalog();
    if (Array.isArray(_massiveSeries)) candidates.push(..._massiveSeries);
  } catch (error) {
    if (SV_DETAIL_VERBOSE) console.warn('[Episodes direct V7] massive catalog:', error.message);
  }
  try {
    const ftp = getCachedSeries();
    if (Array.isArray(ftp)) candidates.push(...ftp);
  } catch (error) {
    if (SV_DETAIL_VERBOSE) console.warn('[Episodes direct V7] FTP catalog:', error.message);
  }
  for (const show of candidates) {
    if (!show) continue;
    const key = svDirectEpisodeKey(show.name || show.title || '');
    if (!key) continue;
    const list = index.get(key) || [];
    list.push(show);
    index.set(key, list);
  }
  svDirectEpisodeIndexV7 = index;
  return index;
}

app.get('/api/series/episodes-direct', (req, res) => {
  try {
    const requestedTitle = req.query.title || req.query.name || req.query.q || '';
    const requestedYear = String(req.query.year || '').match(/(?:19|20)\\d{2}/)?.[0] || '';
    const target = svDirectEpisodeKey(requestedTitle);
    if (!target) return jsonError(res, 400, 'SERIES_TITLE_REQUIRED', 'Series title is required');

    const responseKey = target + '|' + requestedYear;
    const cached = svDirectEpisodeResponseCacheV7.get(responseKey);
    if (cached) {
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.setHeader('X-StreamVault-Episode-Authority', 'v7-cache');
      return res.json(cached);
    }

    const index = svDirectBuildEpisodeIndexV7();
    let candidates = index.get(target) || [];
    if (!candidates.length) {
      candidates = [];
      for (const [key, list] of index.entries()) {
        if (key.startsWith(target + ' ') || target.startsWith(key + ' ')) candidates.push(...list);
      }
    }

    const ranked = candidates.map(show => {
      const seasons = svDirectNormalizeEpisodes(show);
      const episodeCount = Object.values(seasons).reduce((n, eps) => n + eps.length, 0);
      if (!episodeCount) return null;
      const title = show && (show.name || show.title) || '';
      const showYear = String(show.year || title).match(/(?:19|20)\\d{2}/)?.[0] || '';
      let score = episodeCount;
      if (svDirectEpisodeKey(title) === target) score += 10000;
      if (requestedYear && showYear) score += requestedYear === showYear ? 1000 : -500;
      return { show, seasons, episodeCount, score };
    }).filter(Boolean).sort((a, b) => b.score - a.score || b.episodeCount - a.episodeCount);

    const match = ranked[0];
    if (!match) return jsonError(res, 404, 'SERIES_EPISODES_DIRECT_NOT_FOUND', 'Series episodes were not found in direct catalogs');

    const payload = {
      ...match.show,
      id: match.show.id || requestedTitle,
      name: match.show.name || match.show.title || requestedTitle,
      title: match.show.title || match.show.name || requestedTitle,
      type: 'series',
      seasons: match.seasons,
      seasonCount: Object.keys(match.seasons).length,
      episodeCount: match.episodeCount,
      streamAvailable: true,
      hasStream: true,
      isSummary: false,
      authority: 'series-episode-direct-v7'
    };

    svDirectEpisodeResponseCacheV7.set(responseKey, payload);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('X-StreamVault-Episode-Authority', 'v7-index');
    return res.json(payload);
  } catch (error) {
    console.error('[Episodes direct V7] failed:', error.stack || error.message);
    return jsonError(res, 500, 'SERIES_EPISODES_DIRECT_FAILED', error.message || 'Direct episode lookup failed');
  }
});

`;

  source = source.slice(0, start) + block + source.slice(detailAt);
  fs.writeFileSync(serverPath, source, 'utf8');
  console.log('[Startup] Installed fast indexed series episode authority V7.');
  return true;
}

if (require.main === module) {
  try { install(); }
  catch (error) {
    console.error('[Series episode direct V7] install failed:', error.stack || error.message);
    process.exitCode = 1;
  }
}

module.exports = { install };

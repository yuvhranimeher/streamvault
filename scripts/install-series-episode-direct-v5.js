'use strict';

const fs = require('fs');
const path = require('path');

const MARKER = 'SV_SERIES_EPISODE_DIRECT_V5';

function install() {
  const serverPath = path.join(__dirname, '..', 'server.js');
  let source = fs.readFileSync(serverPath, 'utf8');
  if (source.includes(MARKER)) return false;

  const needle = "app.get('/api/series/detail', (req, res) => {";
  const at = source.indexOf(needle);
  if (at < 0) throw new Error('Could not locate /api/series/detail route');

  const block = `// ${MARKER}\nfunction svDirectEpisodeKey(value) {\n  return String(value || '')\n    .toLowerCase()\n    .replace(/\\b(?:19|20)\\d{2}\\b/g, ' ')\n    .replace(/\\b(?:tv\\s+(?:mini\\s+)?series|web\\s+series|mini\\s+series|series)\\b/g, ' ')\n    .replace(/[^a-z0-9]+/g, ' ')\n    .replace(/\\s+/g, ' ')\n    .trim();\n}\n\nfunction svDirectNormalizeEpisodes(show) {\n  const seasonsOut = {};\n  const sourceSeasons = show && show.seasons;\n\n  const put = (seasonNo, rawEpisodes) => {\n    let list = [];\n    if (Array.isArray(rawEpisodes)) list = rawEpisodes;\n    else if (rawEpisodes && Array.isArray(rawEpisodes.episodes)) list = rawEpisodes.episodes;\n    else if (rawEpisodes && typeof rawEpisodes === 'object') list = Object.values(rawEpisodes);\n\n    const normalized = list\n      .filter(Boolean)\n      .map((raw, index) => {\n        const ep = raw && typeof raw === 'object' ? raw : { url: String(raw || '') };\n        const streamUrl = ep.streamUrl || ep.url || ep.src || ep.link || '';\n        const streamId = ep.streamId != null ? ep.streamId : null;\n        if (!streamUrl && streamId == null) return null;\n        return {\n          ...ep,\n          id: ep.id || \`direct_ep_\${seasonNo}_\${index}\`,\n          name: ep.name || ep.title || ep.epTitle || \`Episode \${ep.episode || ep.number || index + 1}\`,\n          episode: Number(ep.episode || ep.number || index + 1) || index + 1,\n          season: Number(ep.season || seasonNo) || 1,\n          streamUrl,\n          url: streamUrl,\n          streamId,\n          isFtp: ep.isFtp !== false\n        };\n      })\n      .filter(Boolean)\n      .sort((a, b) => a.episode - b.episode);\n\n    if (normalized.length) seasonsOut[String(Number(seasonNo) || seasonNo || 1)] = normalized;\n  };\n\n  if (Array.isArray(sourceSeasons)) {\n    sourceSeasons.forEach((seasonObj, index) => {\n      const seasonNo = Number(seasonObj && (seasonObj.season ?? seasonObj.seasonNumber ?? seasonObj.number)) || index + 1;\n      put(seasonNo, seasonObj);\n    });\n  } else if (sourceSeasons && typeof sourceSeasons === 'object') {\n    Object.entries(sourceSeasons).forEach(([seasonNo, value]) => put(seasonNo, value));\n  }\n\n  return seasonsOut;\n}\n\nfunction svDirectEpisodeCount(show) {\n  return Object.values(svDirectNormalizeEpisodes(show)).reduce((n, eps) => n + eps.length, 0);\n}\n\napp.get('/api/series/episodes-direct', (req, res) => {\n  try {\n    const requestedTitle = req.query.title || req.query.name || req.query.q || '';\n    const requestedYear = String(req.query.year || '').match(/(?:19|20)\\d{2}/)?.[0] || '';\n    const target = svDirectEpisodeKey(requestedTitle);\n    if (!target) return jsonError(res, 400, 'SERIES_TITLE_REQUIRED', 'Series title is required');\n\n    const candidates = [];\n\n    try {\n      loadMassiveCatalog();\n      if (Array.isArray(_massiveSeries)) candidates.push(..._massiveSeries);\n    } catch (error) {\n      if (SV_DETAIL_VERBOSE) console.warn('[Episodes direct] massive catalog:', error.message);\n    }\n\n    try {\n      const ftp = getCachedSeries();\n      if (Array.isArray(ftp)) candidates.push(...ftp);\n    } catch (error) {\n      if (SV_DETAIL_VERBOSE) console.warn('[Episodes direct] FTP catalog:', error.message);\n    }\n\n    const ranked = candidates\n      .map(show => {\n        const title = show && (show.name || show.title) || '';\n        const key = svDirectEpisodeKey(title);\n        const episodeCount = svDirectEpisodeCount(show);\n        if (!key || !episodeCount) return null;\n        let score = 0;\n        if (key === target) score += 10000;\n        else if (key.startsWith(target + ' ') || target.startsWith(key + ' ')) score += 5000;\n        else return null;\n        const showYear = String(show.year || title).match(/(?:19|20)\\d{2}/)?.[0] || '';\n        if (requestedYear && showYear) score += requestedYear === showYear ? 1000 : -500;\n        score += Math.min(episodeCount, 999);\n        return { show, score, episodeCount };\n      })\n      .filter(Boolean)\n      .sort((a, b) => b.score - a.score || b.episodeCount - a.episodeCount);\n\n    const match = ranked[0];\n    if (!match) return jsonError(res, 404, 'SERIES_EPISODES_DIRECT_NOT_FOUND', 'Series episodes were not found in direct catalogs');\n\n    const seasons = svDirectNormalizeEpisodes(match.show);\n    const episodeCount = Object.values(seasons).reduce((n, eps) => n + eps.length, 0);\n    res.setHeader('Cache-Control', 'private, max-age=300');\n    return res.json({\n      ...match.show,\n      id: match.show.id || requestedTitle,\n      name: match.show.name || match.show.title || requestedTitle,\n      title: match.show.title || match.show.name || requestedTitle,\n      type: 'series',\n      seasons,\n      seasonCount: Object.keys(seasons).length,\n      episodeCount,\n      streamAvailable: episodeCount > 0,\n      hasStream: episodeCount > 0,\n      isSummary: false,\n      authority: 'series-episode-direct-v5'\n    });\n  } catch (error) {\n    console.error('[Episodes direct] failed:', error.stack || error.message);\n    return jsonError(res, 500, 'SERIES_EPISODES_DIRECT_FAILED', error.message || 'Direct episode lookup failed');\n  }\n});\n\n`;

  source = source.slice(0, at) + block + source.slice(at);
  fs.writeFileSync(serverPath, source, 'utf8');
  console.log('[Startup] Installed series episode direct authority V5.');
  return true;
}

if (require.main === module) {
  try { install(); }
  catch (error) {
    console.error('[Series episode direct V5] install failed:', error.stack || error.message);
    process.exitCode = 1;
  }
}

module.exports = { install };

'use strict';

const fs = require('fs');
const path = require('path');

const MARKER = 'SV_SERIES_EPISODE_METADATA_V8';

function install() {
  const serverPath = path.join(__dirname, '..', 'server.js');
  let source = fs.readFileSync(serverPath, 'utf8');
  if (source.includes(MARKER)) return false;

  const needle = "app.get('/api/series/detail', (req, res) => {";
  const at = source.indexOf(needle);
  if (at < 0) throw new Error('Could not locate /api/series/detail route');

  const block = `// ${MARKER}\nconst svEpisodeMetadataCacheV8 = new Map();\n\nfunction svEpisodeMetadataKeyV8(value) {\n  return String(value || '')\n    .toLowerCase()\n    .replace(/\\b(?:19|20)\\d{2}\\b/g, ' ')\n    .replace(/\\b(?:tv\\s+(?:mini\\s+)?series|web\\s+series|mini\\s+series|series)\\b/g, ' ')\n    .replace(/\\b(?:2160p|1080p|720p|480p|4k|uhd|hdr|dual\\s+audio|multi\\s+audio)\\b/g, ' ')\n    .replace(/[^a-z0-9]+/g, ' ')\n    .replace(/\\s+/g, ' ')\n    .trim();\n}\n\nfunction svEpisodeMetadataYearV8(value) {\n  return String(value || '').match(/(?:19|20)\\d{2}/)?.[0] || '';\n}\n\nasync function svResolveTmdbSeriesV8(title, year) {\n  const clean = svEpisodeMetadataKeyV8(title);\n  if (!clean || typeof tmdbGet !== 'function') return null;\n  const query = encodeURIComponent(clean);\n  const yearPart = year ? '&first_air_date_year=' + encodeURIComponent(year) : '';\n  const search = await tmdbGet('/search/tv?query=' + query + yearPart + '&include_adult=false&language=en-US&page=1');\n  const results = Array.isArray(search?.results) ? search.results : [];\n  if (!results.length) return null;\n\n  const ranked = results.map(item => {\n    const key = svEpisodeMetadataKeyV8(item?.name || item?.original_name || '');\n    const itemYear = svEpisodeMetadataYearV8(item?.first_air_date || '');\n    let score = 0;\n    if (key === clean) score += 1000;\n    else if (key.startsWith(clean + ' ') || clean.startsWith(key + ' ')) score += 500;\n    else return null;\n    if (year && itemYear) score += year === itemYear ? 200 : -100;\n    score += Number(item?.popularity || 0) / 1000;\n    return { item, score };\n  }).filter(Boolean).sort((a, b) => b.score - a.score);\n\n  return ranked[0]?.item || results[0] || null;\n}\n\napp.get('/api/series/episode-metadata', async (req, res) => {\n  try {\n    const title = String(req.query.title || req.query.name || '').trim();\n    const year = svEpisodeMetadataYearV8(req.query.year || title);\n    if (!title) return jsonError(res, 400, 'SERIES_TITLE_REQUIRED', 'Series title is required');\n\n    const seasonNumbers = [...new Set(String(req.query.seasons || '')\n      .split(',')\n      .map(value => Number(value))\n      .filter(value => Number.isInteger(value) && value > 0 && value <= 100))]\n      .sort((a, b) => a - b);\n    if (!seasonNumbers.length) seasonNumbers.push(1);\n\n    const cacheKey = svEpisodeMetadataKeyV8(title) + '|' + year + '|' + seasonNumbers.join(',');\n    const cached = svEpisodeMetadataCacheV8.get(cacheKey);\n    if (cached) {\n      res.setHeader('Cache-Control', 'public, max-age=86400');\n      res.setHeader('X-StreamVault-Episode-Metadata', 'v8-cache');\n      return res.json(cached);\n    }\n\n    const show = await svResolveTmdbSeriesV8(title, year);\n    if (!show?.id) return jsonError(res, 404, 'SERIES_METADATA_NOT_FOUND', 'Series metadata was not found');\n\n    const seasonPayloads = await Promise.all(seasonNumbers.map(async seasonNumber => {\n      const data = await tmdbGet('/tv/' + encodeURIComponent(show.id) + '/season/' + seasonNumber + '?language=en-US');\n      return { seasonNumber, data };\n    }));\n\n    const seasons = {};\n    for (const { seasonNumber, data } of seasonPayloads) {\n      const episodes = Array.isArray(data?.episodes) ? data.episodes : [];\n      seasons[String(seasonNumber)] = episodes.map(ep => ({\n        episode: Number(ep?.episode_number || 0),\n        title: String(ep?.name || '').trim(),\n        overview: String(ep?.overview || '').trim(),\n        airDate: String(ep?.air_date || ''),\n        runtime: Number(ep?.runtime || 0) || null,\n        still: ep?.still_path ? ('https://image.tmdb.org/t/p/w500' + ep.still_path) : ''\n      })).filter(ep => ep.episode > 0 && ep.title);\n    }\n\n    const payload = {\n      ok: true,\n      authority: 'series-episode-metadata-v8',\n      tmdbId: show.id,\n      title: show.name || title,\n      year: svEpisodeMetadataYearV8(show.first_air_date || '') || year,\n      seasons\n    };\n    svEpisodeMetadataCacheV8.set(cacheKey, payload);\n    res.setHeader('Cache-Control', 'public, max-age=86400');\n    res.setHeader('X-StreamVault-Episode-Metadata', 'v8-tmdb');\n    return res.json(payload);\n  } catch (error) {\n    console.error('[Episode metadata V8] failed:', error.stack || error.message);\n    return jsonError(res, 500, 'SERIES_METADATA_FAILED', error.message || 'Episode metadata lookup failed');\n  }\n});\n\n`;

  source = source.slice(0, at) + block + source.slice(at);
  fs.writeFileSync(serverPath, source, 'utf8');
  console.log('[Startup] Installed TMDB episode metadata authority V8.');
  return true;
}

if (require.main === module) {
  try { install(); }
  catch (error) {
    console.error('[Episode metadata V8] install failed:', error.stack || error.message);
    process.exitCode = 1;
  }
}

module.exports = { install };

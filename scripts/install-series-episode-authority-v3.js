'use strict';

const fs = require('fs');
const path = require('path');

const MARKER = 'SV_SERIES_EPISODE_AUTHORITY_V3';

function installSeriesEpisodeAuthorityV3() {
  const serverPath = path.join(__dirname, '..', 'server.js');
  let source = fs.readFileSync(serverPath, 'utf8');
  if (source.includes(MARKER)) return false;

  const startNeedle = 'function allApiSeriesForDetails() {';
  const nextNeedle = '\nfunction splitDetailGenres';
  const start = source.indexOf(startNeedle);
  const end = source.indexOf(nextNeedle, start);
  if (start < 0 || end < 0 || end <= start) {
    throw new Error('Could not locate allApiSeriesForDetails() in server.js');
  }

  const replacement = `function allApiSeriesForDetails() {
  // ${MARKER}
  const localSeries = _seriesList || buildSeriesListSync();
  const ftpSeries = getCachedSeries()
    .filter(s => !isCartoonOrAnime(s))
    .map((s, i) => ({
      ...s,
      id: s.id || \`ftp_series_\${i}\`,
      name: s.name || s.title,
      title: s.title || s.name,
      type: 'series',
      seasons: Object.entries(s.seasons || {}).reduce((acc, [season, episodes]) => {
        acc[season] = (episodes || []).map((ep, j) => ({
          ...ep,
          id: ep.id || \`ftp_ep_\${i}_\${season}_\${j}\`,
          name: ep.name || ep.title || \`Episode \${j + 1}\`,
          episode: Number(ep.episode || ep.number || j + 1),
          season: Number(ep.season || season) || 1,
          streamUrl: ep.streamUrl || ep.url || ep.src || ep.link || '',
          url: ep.url || ep.streamUrl || ep.src || ep.link || '',
          streamId: ep.streamId != null ? ep.streamId : null,
          isFtp: true
        }));
        return acc;
      }, {}),
      isFtp: true,
      _isSeries: true
    }));

  // V9 has already loaded the massive catalog before the server listens.
  // Keep its playable series in the normal detail fallback as well.
  loadMassiveCatalog();
  const massiveSeries = (_massiveSeries || []).filter(show =>
    Object.values(show?.seasons || {}).some(episodes =>
      Array.isArray(episodes) && episodes.some(ep => ep?.streamUrl || ep?.url || ep?.streamId != null)
    )
  );
  return [...localSeries, ...ftpSeries, ...massiveSeries];
}
`;

  source = source.slice(0, start) + replacement + source.slice(end);
  fs.writeFileSync(serverPath, source, 'utf8');
  console.log('[Startup] Installed global series detail authority V3.');
  return true;
}

if (require.main === module) {
  try { installSeriesEpisodeAuthorityV3(); }
  catch (error) {
    console.error('[Series episode authority V3] install failed:', error.stack || error.message);
    process.exitCode = 1;
  }
}

module.exports = { installSeriesEpisodeAuthorityV3 };

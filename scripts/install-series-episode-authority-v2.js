'use strict';

const fs = require('fs');
const path = require('path');

const MARKER = 'SV_SERIES_EPISODE_AUTHORITY_V2';
const LEGACY_MARKER = 'SV_SERIES_EPISODE_AUTHORITY_V1';

function installSeriesEpisodeAuthorityV2() {
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
  // ${LEGACY_MARKER} compatibility marker: prevents an older startup installer
  // from replacing this V2 implementation on machines that still have V1.
  // Keep every local and FTP candidate. The detail route itself filters for
  // playable episodes before title/id matching. Dedupe here can hide the real
  // FTP series behind a zero-episode summary with the same title.
  const localSeries = _seriesList || buildSeriesListSync();
  const ftpSeries = getCachedSeries()
    .filter(s => !isCartoonOrAnime(s))
    .map((s, i) => ({
      id: \`ftp_series_\${i}\`,
      name: s.title,
      title: s.title,
      poster: s.poster || null,
      backdrop: s.backdrop || s.poster || null,
      tmdbId: s.tmdbId || null,
      year: s.year || '',
      rating: s.rating || null,
      type: 'series',
      genre: s.genre || '',
      category: s.category || 'Series',
      seasons: Object.entries(s.seasons || {}).reduce((acc, [season, episodes]) => {
        acc[season] = (episodes || []).map((ep, j) => ({
          id: ep.id || \`ftp_ep_\${i}_\${season}_\${j}\`,
          name: ep.name || \`Episode \${j + 1}\`,
          episode: ep.episode || j + 1,
          season: parseInt(season, 10) || 1,
          streamUrl: ep.url || ep.streamUrl,
          url: ep.url || ep.streamUrl,
          streamId: ep.streamId != null ? ep.streamId : null,
          isFtp: true
        }));
        return acc;
      }, {}),
      isFtp: true,
      _isSeries: true
    }));

  return [...localSeries, ...ftpSeries];
}
`;

  source = source.slice(0, start) + replacement + source.slice(end);
  fs.writeFileSync(serverPath, source, 'utf8');
  console.log('[Startup] Installed global series episode authority V2.');
  return true;
}

if (require.main === module) {
  try {
    installSeriesEpisodeAuthorityV2();
  } catch (error) {
    console.error('[Series episode authority V2] install failed:', error.message);
    process.exitCode = 1;
  }
}

module.exports = { installSeriesEpisodeAuthorityV2 };

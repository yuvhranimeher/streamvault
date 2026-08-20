'use strict';

const { buildRuntimeSearchCatalog } = require('./build-runtime-search-catalog');
const { installSeriesEpisodeAuthorityV3 } = require('./install-series-episode-authority-v3');
const { install: installSeriesEpisodeDirectV9 } = require('./install-series-episode-direct-v9');
const { install: installSeriesEpisodeMetadataV8 } = require('./install-series-episode-metadata-v8');

(async () => {
  try {
    await buildRuntimeSearchCatalog();
  } catch (error) {
    console.error('[Startup] Search catalog preparation failed; starting StreamVault with existing data.', error.message);
  }

  try {
    installSeriesEpisodeAuthorityV3();
    installSeriesEpisodeDirectV9();
    installSeriesEpisodeMetadataV8();
  } catch (error) {
    console.error('[Startup] Series episode authority install failed; starting with existing server code.', error.stack || error.message);
  }

  require('../server.js');
})();

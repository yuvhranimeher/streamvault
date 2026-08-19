'use strict';

const { buildRuntimeSearchCatalog } = require('./build-runtime-search-catalog');
const { installSeriesEpisodeAuthority } = require('./install-series-episode-authority-v1');

(async () => {
  try {
    installSeriesEpisodeAuthority();
  } catch (error) {
    console.error('[Startup] Series episode authority install failed; starting with existing server code.', error.message);
  }

  try {
    await buildRuntimeSearchCatalog();
  } catch (error) {
    console.error('[Startup] Search catalog preparation failed; starting StreamVault with existing data.', error.message);
  }

  require('../server.js');
})();

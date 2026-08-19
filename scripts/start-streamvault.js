'use strict';

const { buildRuntimeSearchCatalog } = require('./build-runtime-search-catalog');
const { installSeriesEpisodeAuthorityV2 } = require('./install-series-episode-authority-v2');

(async () => {
  try {
    installSeriesEpisodeAuthorityV2();
  } catch (error) {
    console.error('[Startup] Series episode authority V2 install failed; starting with existing server code.', error.message);
  }

  try {
    await buildRuntimeSearchCatalog();
  } catch (error) {
    console.error('[Startup] Search catalog preparation failed; starting StreamVault with existing data.', error.message);
  }

  require('../server.js');
})();

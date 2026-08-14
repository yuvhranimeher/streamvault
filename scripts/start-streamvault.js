'use strict';

const { buildRuntimeSearchCatalog } = require('./build-runtime-search-catalog');

(async () => {
  try {
    await buildRuntimeSearchCatalog();
  } catch (error) {
    console.error('[Startup] Search catalog preparation failed; starting StreamVault with existing data.', error.message);
  }

  require('../server.js');
})();

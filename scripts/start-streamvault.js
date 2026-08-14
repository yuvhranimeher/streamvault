'use strict';

const { buildRuntimeSearchCatalog } = require('./build-runtime-search-catalog');

(async () => {
  try {
    await buildRuntimeSearchCatalog();
  } catch (error) {
    // Search-catalog generation must never prevent the existing site from booting.
    console.error('[Startup] Search catalog preparation failed; starting StreamVault with existing data.', error.message);
  }

  require('../server.js');
})();

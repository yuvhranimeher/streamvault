'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');

const {
  FLAG_NAME,
  getInactiveHaskellPlaybackRouteMode
} = require('./inactive-playback-route-flags');

const TOOLS_DIR = path.join(__dirname, '..', 'tools', 'playback-parity-v1');

function fileExists(name) {
  return fs.existsSync(path.join(TOOLS_DIR, name));
}

function buildInactivePlaybackRouteEnvelope(req, mode) {
  return {
    ok: true,
    route: 'inactive-haskell-playback-route',
    activation: 'controlled-feature-flag',
    mode,
    featureFlag: {
      name: FLAG_NAME,
      value: mode,
      default: 'off',
      disable: `unset ${FLAG_NAME} or set ${FLAG_NAME}=off`
    },
    implementation: {
      shadowOnly: true,
      haskellModulePresent: fileExists('InactivePlaybackRouteImplementationShadow.hs'),
      implementationContractPresent: fileExists('inactive-playback-route-implementation-shadow-contract.json'),
      finalReadinessContractPresent: fileExists('inactive-playback-route-final-readiness-contract.json')
    },
    safety: {
      networkCalled: false,
      ftpCalled: false,
      liveUrlActivated: false,
      ffmpegStarted: false,
      desktopDirectPlayChanged: false,
      mobileHlsChanged: false
    },
    request: {
      method: req.method,
      path: req.path,
      queryKeys: Object.keys(req.query || {}).sort()
    }
  };
}

function createInactivePlaybackRouteHaskellRouter() {
  const router = express.Router();

  router.use((req, res, next) => {
    const mode = getInactiveHaskellPlaybackRouteMode();
    res.setHeader('X-StreamVault-Inactive-Haskell-Playback-Flag', mode);

    if (mode === 'off') {
      return res.status(404).json({
        ok: false,
        error: 'inactive_haskell_playback_route_disabled',
        featureFlag: {
          name: FLAG_NAME,
          value: mode,
          default: 'off',
          rollback: `unset ${FLAG_NAME} or set ${FLAG_NAME}=off`
        },
        existingNodePlaybackPreserved: true
      });
    }

    req.inactiveHaskellPlaybackRouteMode = mode;
    next();
  });

  router.get('/health', (req, res) => {
    res.json(buildInactivePlaybackRouteEnvelope(req, req.inactiveHaskellPlaybackRouteMode));
  });

  router.get('/resolve', (req, res) => {
    res.json(buildInactivePlaybackRouteEnvelope(req, req.inactiveHaskellPlaybackRouteMode));
  });

  router.post('/resolve', (req, res) => {
    res.json(buildInactivePlaybackRouteEnvelope(req, req.inactiveHaskellPlaybackRouteMode));
  });

  return router;
}

module.exports = {
  createInactivePlaybackRouteHaskellRouter,
  buildInactivePlaybackRouteEnvelope
};

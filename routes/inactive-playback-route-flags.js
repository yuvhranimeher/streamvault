'use strict';

const FLAG_NAME = 'STREAMVAULT_INACTIVE_HASKELL_PLAYBACK_ROUTE';
const ALLOWED_MODES = new Set(['off', 'shadow', 'canary', 'on']);

function normalizeInactiveHaskellPlaybackRouteFlag(value = process.env[FLAG_NAME]) {
  const raw = String(value ?? '').trim().toLowerCase();

  if (!raw || raw === '0' || raw === 'false' || raw === 'no' || raw === 'disabled') {
    return 'off';
  }

  if (ALLOWED_MODES.has(raw)) return raw;

  return 'off';
}

function getInactiveHaskellPlaybackRouteMode(env = process.env) {
  return normalizeInactiveHaskellPlaybackRouteFlag(env[FLAG_NAME]);
}

function isInactiveHaskellPlaybackRouteEnabled(env = process.env) {
  return getInactiveHaskellPlaybackRouteMode(env) !== 'off';
}

module.exports = {
  FLAG_NAME,
  ALLOWED_MODES: Array.from(ALLOWED_MODES),
  normalizeInactiveHaskellPlaybackRouteFlag,
  getInactiveHaskellPlaybackRouteMode,
  isInactiveHaskellPlaybackRouteEnabled
};

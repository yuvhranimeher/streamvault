#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
  FLAG_NAME,
  ALLOWED_MODES,
  normalizeInactiveHaskellPlaybackRouteFlag,
  getInactiveHaskellPlaybackRouteMode,
  isInactiveHaskellPlaybackRouteEnabled
} = require('../../routes/inactive-playback-route-flags');

const {
  buildInactivePlaybackRouteEnvelope
} = require('../../routes/inactive-playback-route-haskell');

const root = path.resolve(__dirname, '..', '..');

function checkNormalize() {
  const cases = [
    [undefined, 'off'],
    ['', 'off'],
    ['0', 'off'],
    ['false', 'off'],
    ['no', 'off'],
    ['disabled', 'off'],
    ['OFF', 'off'],
    ['shadow', 'shadow'],
    ['canary', 'canary'],
    ['on', 'on'],
    ['bad-value', 'off']
  ];

  for (const [input, expected] of cases) {
    assert.strictEqual(normalizeInactiveHaskellPlaybackRouteFlag(input), expected, `normalize ${input}`);
  }

  assert.deepStrictEqual(ALLOWED_MODES.slice().sort(), ['canary', 'off', 'on', 'shadow']);
}

function checkEnvModes() {
  for (const mode of ['off', 'shadow', 'canary', 'on']) {
    const env = { [FLAG_NAME]: mode };
    assert.strictEqual(getInactiveHaskellPlaybackRouteMode(env), mode);
    assert.strictEqual(isInactiveHaskellPlaybackRouteEnabled(env), mode !== 'off');
  }

  assert.strictEqual(getInactiveHaskellPlaybackRouteMode({}), 'off');
  assert.strictEqual(isInactiveHaskellPlaybackRouteEnabled({}), false);
}

function checkEnvelope() {
  for (const mode of ['shadow', 'canary', 'on']) {
    const req = {
      method: 'GET',
      path: '/health',
      query: { z: 'last', a: 'first' }
    };

    const envelope = buildInactivePlaybackRouteEnvelope(req, mode);

    assert.strictEqual(envelope.ok, true);
    assert.strictEqual(envelope.route, 'inactive-haskell-playback-route');
    assert.strictEqual(envelope.activation, 'controlled-feature-flag');
    assert.strictEqual(envelope.mode, mode);
    assert.strictEqual(envelope.featureFlag.name, FLAG_NAME);
    assert.strictEqual(envelope.featureFlag.default, 'off');
    assert.strictEqual(envelope.safety.networkCalled, false);
    assert.strictEqual(envelope.safety.ftpCalled, false);
    assert.strictEqual(envelope.safety.liveUrlActivated, false);
    assert.strictEqual(envelope.safety.ffmpegStarted, false);
    assert.strictEqual(envelope.safety.desktopDirectPlayChanged, false);
    assert.strictEqual(envelope.safety.mobileHlsChanged, false);
    assert.deepStrictEqual(envelope.request.queryKeys, ['a', 'z']);
  }
}

function checkRollbackAndMountText() {
  const serverText = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  const routeText = fs.readFileSync(path.join(root, 'routes', 'inactive-playback-route-haskell.js'), 'utf8');

  assert(serverText.includes("createInactivePlaybackRouteHaskellRouter"));
  assert(serverText.includes("app.use('/api/playback/inactive-haskell', createInactivePlaybackRouteHaskellRouter());"));

  assert(routeText.includes("mode === 'off'"));
  assert(routeText.includes("status(404)"));
  assert(routeText.includes("existingNodePlaybackPreserved: true"));
  assert(routeText.includes("networkCalled: false"));
  assert(routeText.includes("ffmpegStarted: false"));
  assert(routeText.includes("desktopDirectPlayChanged: false"));
  assert(routeText.includes("mobileHlsChanged: false"));
}

checkNormalize();
checkEnvModes();
checkEnvelope();
checkRollbackAndMountText();

console.log('CONTROLLED_ACTIVATION_SMOKE_PASS');
console.log(`FEATURE_FLAG=${FLAG_NAME}`);
console.log('MODES=off,shadow,canary,on');
console.log('ROLLBACK=unset flag or set off');

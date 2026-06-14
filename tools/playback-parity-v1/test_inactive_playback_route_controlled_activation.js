'use strict';

const assert = require('assert');

const flags = require('../../routes/inactive-playback-route-flags');
const bridge = require('../../routes/inactive-playback-route-haskell');

assert.strictEqual(flags.normalizeInactiveHaskellPlaybackRouteFlag(undefined), 'off');
assert.strictEqual(flags.normalizeInactiveHaskellPlaybackRouteFlag(''), 'off');
assert.strictEqual(flags.normalizeInactiveHaskellPlaybackRouteFlag('0'), 'off');
assert.strictEqual(flags.normalizeInactiveHaskellPlaybackRouteFlag('false'), 'off');
assert.strictEqual(flags.normalizeInactiveHaskellPlaybackRouteFlag('no'), 'off');
assert.strictEqual(flags.normalizeInactiveHaskellPlaybackRouteFlag('bad-value'), 'off');
assert.strictEqual(flags.normalizeInactiveHaskellPlaybackRouteFlag('shadow'), 'shadow');
assert.strictEqual(flags.normalizeInactiveHaskellPlaybackRouteFlag('canary'), 'canary');
assert.strictEqual(flags.normalizeInactiveHaskellPlaybackRouteFlag('on'), 'on');

assert.strictEqual(flags.isInactiveHaskellPlaybackRouteEnabled({}), false);
assert.strictEqual(flags.isInactiveHaskellPlaybackRouteEnabled({ STREAMVAULT_INACTIVE_HASKELL_PLAYBACK_ROUTE: 'off' }), false);
assert.strictEqual(flags.isInactiveHaskellPlaybackRouteEnabled({ STREAMVAULT_INACTIVE_HASKELL_PLAYBACK_ROUTE: 'on' }), true);

const fakeReq = {
  method: 'GET',
  path: '/health',
  query: { fixture: 'default' }
};

const envelope = bridge.buildInactivePlaybackRouteEnvelope(fakeReq, 'shadow');

assert.strictEqual(envelope.ok, true);
assert.strictEqual(envelope.featureFlag.name, flags.FLAG_NAME);
assert.strictEqual(envelope.mode, 'shadow');
assert.strictEqual(envelope.safety.networkCalled, false);
assert.strictEqual(envelope.safety.ftpCalled, false);
assert.strictEqual(envelope.safety.ffmpegStarted, false);
assert.strictEqual(envelope.safety.desktopDirectPlayChanged, false);
assert.strictEqual(envelope.safety.mobileHlsChanged, false);

console.log('CONTROLLED_ACTIVATION_GATE_PASS');

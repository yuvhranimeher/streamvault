'use strict';

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');
const stableCommit = '5481e0b0d93874fe7d0118d2357cc185f82c7662';

function git(...args) {
  return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' });
}

function relayV1Source(source) {
  const start = source.indexOf('const SV_LIVE_DEBUG');
  const end = source.indexOf("app.get('/api/live-test/:channelId'");
  assert.ok(start >= 0 && end > start, 'could not locate the existing Live TV implementation');
  return source.slice(start, end);
}

test('existing direct proxy and live-relay v1 implementation are line-for-line unchanged', () => {
  const stable = git('show', `${stableCommit}:server.js`);
  const current = fs.readFileSync(path.join(repoRoot, 'server.js'), 'utf8');
  assert.equal(
    relayV1Source(current).replace(/\r\n/g, '\n'),
    relayV1Source(stable).replace(/\r\n/g, '\n')
  );
});

test('server registers v2 and active frontends prefer it while retaining v1 fallback', () => {
  const server = fs.readFileSync(path.join(repoRoot, 'server.js'), 'utf8');
  const relayV2 = fs.readFileSync(path.join(repoRoot, 'lib', 'live-relay-v2.js'), 'utf8');
  const publicApp = fs.readFileSync(path.join(repoRoot, 'public', 'app.js'), 'utf8');
  const hostingerApp = fs.readFileSync(path.join(repoRoot, 'hostinger', 'app-v3.js'), 'utf8');

  assert.match(server, /createLiveRelayV2/);
  assert.match(server, /liveRelayV2\.registerRoutes/);
  assert.match(relayV2, /res\.redirect\(307, `\/live-relay\/\$\{encodeURIComponent\(channelId\)\}\/playlist\.m3u8`\)/);
  assert.match(publicApp, /`\/live-relay-v2\/\$\{encodeURIComponent\(channelId\)\}\/playlist\.m3u8`/);
  assert.match(hostingerApp, /`\$\{API_BASE\}\/live-relay-v2\/\$\{encodeURIComponent\(channelId\)\}\/playlist\.m3u8`/);
});

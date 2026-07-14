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

test('server integration is additive and Hostinger playback files are untouched', () => {
  const serverDiff = git('diff', '--unified=0', stableCommit, '--', 'server.js');
  const removedCode = serverDiff.split(/\r?\n/).filter(line =>
    line.startsWith('-') && !line.startsWith('---')
  );
  assert.deepEqual(removedCode, []);
  assert.match(serverDiff, /createLiveRelayV2/);
  assert.match(serverDiff, /liveRelayV2\.registerRoutes/);

  const hostingerChanges = git('diff', '--name-only', stableCommit, '--', 'hostinger');
  assert.equal(hostingerChanges.trim(), '');
});

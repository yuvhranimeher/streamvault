const assert = require('assert');
const path = require('path');
const {
  captureRenderedHomepage,
  readSnapshotModule,
  snapshotItem,
  startProxyServer,
  validateCurrentRows
} = require('./capture-home-snapshot');

const ROOT = __dirname;
const SNAPSHOT_FILE = path.join(ROOT, 'home-snapshot-76d0639-20260717.js');

function comparableRows(rows) {
  return rows.map(row => ({
    rowId: row.rowId,
    sectionKey: row.sectionKey,
    title: row.title,
    items: row.items.map(snapshotItem)
  }));
}

function assertFeedEquality(actualRows, expectedRows, label) {
  assert.strictEqual(actualRows.length, expectedRows.length, `${label}: row count differs`);
  for (let rowIndex = 0; rowIndex < expectedRows.length; rowIndex += 1) {
    const actual = actualRows[rowIndex];
    const expected = expectedRows[rowIndex];
    assert.strictEqual(actual.rowId, expected.rowId, `${label}: row ID differs at ${rowIndex}`);
    assert.strictEqual(actual.sectionKey, expected.sectionKey, `${label}: section key differs in ${expected.rowId}`);
    assert.strictEqual(actual.title, expected.title, `${label}: row name differs in ${expected.rowId}`);
    assert.strictEqual(actual.items.length, expected.items.length, `${label}: card count differs in ${expected.rowId}`);
    for (let itemIndex = 0; itemIndex < expected.items.length; itemIndex += 1) {
      const actualItem = actual.items[itemIndex];
      const expectedItem = expected.items[itemIndex];
      assert.strictEqual(actualItem.id, expectedItem.id, `${label}: media ID/order differs in ${expected.rowId} at ${itemIndex}`);
      for (const field of ['name', 'title', 'year', 'rating', 'type', 'poster', 'backdrop']) {
        assert.deepStrictEqual(
          actualItem[field],
          expectedItem[field],
          `${label}: ${field} differs for ${expectedItem.id}`
        );
      }
    }
  }
}

(async () => {
  const snapshot = readSnapshotModule(SNAPSHOT_FILE);
  validateCurrentRows(snapshot.rows);

  const online = await captureRenderedHomepage({ url: 'https://streamvault.fit/' });
  const onlineRows = comparableRows(online.rows);
  assertFeedEquality(onlineRows, snapshot.rows, 'online production vs bundled snapshot');

  const server = await startProxyServer(ROOT);
  try {
    const offline = await captureRenderedHomepage({
      url: server.url,
      blockBackend: true
    });
    const offlineRows = comparableRows(offline.rows);
    assertFeedEquality(offlineRows, snapshot.rows, 'backend-blocked DOM vs bundled snapshot');
    assert(
      offline.backendRequests.some(url => url.startsWith('https://backend.streamvault.fit/')),
      'backend-blocked test did not observe a background backend request'
    );
  } finally {
    await server.close();
  }

  const cardCount = snapshot.rows.reduce((count, row) => count + row.items.length, 0);
  console.log(`Online/offline homepage equality passed: ${snapshot.rows.length} rows, ${cardCount} ordered cards`);
})().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});

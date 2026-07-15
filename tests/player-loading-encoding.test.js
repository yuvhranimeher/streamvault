const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  PLAYER_EVENTS,
  createCentralPlaybackController,
  repairDisplayText
} = require('../lib/frontend-player-ui');

class FakeElement {
  constructor() {
    this.innerHTML = '';
    this.attributes = new Map();
    this.dataset = {};
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name); }
}

class FakeVideo {
  constructor() {
    this.paused = true;
    this.ended = false;
    this.error = null;
    this.readyState = 0;
    this.currentSrc = '';
    this.listeners = new Map();
  }
  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }
  removeEventListener(type, listener) {
    this.listeners.set(type, (this.listeners.get(type) || []).filter(item => item !== listener));
  }
  emit(type) { for (const listener of this.listeners.get(type) || []) listener({ type }); }
}

function createHarness() {
  const video = new FakeVideo();
  const button = new FakeElement();
  const transportIcon = new FakeElement();
  const controller = createCentralPlaybackController({ video, button, transportIcon });
  controller.bind();
  return { video, button, transportIcon, controller };
}

function assertCentralState(harness, expected) {
  assert.strictEqual(harness.controller.getState(), expected);
  assert.strictEqual(harness.button.dataset.playbackState, expected);
  const hasSpinner = harness.button.innerHTML.includes('central-playback-spinner');
  const hasIcon = harness.button.innerHTML.includes('central-playback-icon');
  assert.notStrictEqual(hasSpinner, hasIcon, 'exactly one central state visual must be rendered');
}

{
  const harness = createHarness();
  harness.controller.beginLoading();
  assertCentralState(harness, 'loading');

  harness.video.paused = false;
  harness.video.readyState = 4;
  harness.video.emit('playing');
  assertCentralState(harness, 'playing');
  assert(harness.button.innerHTML.includes('M6 19h4V5H6v14'));

  harness.video.emit('waiting');
  assertCentralState(harness, 'loading');
  harness.video.emit('playing');
  assertCentralState(harness, 'playing');

  harness.video.emit('seeking');
  assertCentralState(harness, 'loading');
  harness.video.emit('seeked');
  assertCentralState(harness, 'playing');

  harness.video.paused = true;
  harness.video.emit('pause');
  assertCentralState(harness, 'paused');

  harness.video.error = new Error('failed');
  harness.video.emit('error');
  assertCentralState(harness, 'error');
  assert(!harness.button.innerHTML.includes('central-playback-spinner'));

  harness.video.error = null;
  harness.controller.beginLoading();
  harness.video.currentSrc = 'movie-2.mp4';
  harness.video.emit('loadstart');
  assertCentralState(harness, 'loading');

  const controllerListenerCounts = [...harness.video.listeners.values()].map(list => list.length);
  harness.controller.bind();
  assert(controllerListenerCounts.every((count, index) => harness.video.listeners.get(PLAYER_EVENTS[index]).length === count));
  assert.strictEqual(harness.controller.listenerCount(), PLAYER_EVENTS.length);
  harness.controller.unbind();
  assert([...harness.video.listeners.values()].every(list => list.length === 0));
}

{
  assert.strictEqual(repairDisplayText('S01E08 Ã¢â‚¬â€œ Episode 8'), 'S01E08 – Episode 8');
  assert.strictEqual(repairDisplayText('1Ãƒâ€”'), '1×');
  assert.strictEqual(repairDisplayText('SearchÃ¢â‚¬Â¦'), 'Search…');
  assert.strictEqual(repairDisplayText('Euphoria (TV Series 2019Ã¢â‚¬â€œ )'), 'Euphoria (TV Series 2019– )');
  assert.strictEqual(repairDisplayText('Already correct – “title” … 1×'), 'Already correct – “title” … 1×');
  assert.strictEqual(repairDisplayText('বাংলা हिन्दी 日本語 العربية café 😀'), 'বাংলা हिन्दी 日本語 العربية café 😀');
  assert.strictEqual(repairDisplayText('https://media.example/S01E08-Ã¢â‚¬â€œ.m3u8'), 'https://media.example/S01E08-Ã¢â‚¬â€œ.m3u8');
  assert.strictEqual(repairDisplayText('stream_Ã¢â‚¬â€œ_identifier', { kind: 'identifier' }), 'stream_Ã¢â‚¬â€œ_identifier');
}

{
  const root = path.resolve(__dirname, '..');
  for (const relative of ['public/index.html', 'hostinger/index.html']) {
    const html = fs.readFileSync(path.join(root, relative), 'utf8');
    assert(!html.includes('playerSpinner'), `${relative} still contains the seek-row loading indicator`);
    assert(html.includes('id="ppCenterBtn"'), `${relative} is missing the central playback control`);
    assert(html.includes('frontend-player-ui.js?v=20260715-player-loading-ui-v1'), `${relative} is missing the canonical player UI asset`);
  }
  for (const relative of ['public/styles.css', 'hostinger/styles.css']) {
    const css = fs.readFileSync(path.join(root, relative), 'utf8');
    assert(!css.includes('.player-spinner'), `${relative} still reserves seek-row spinner space`);
    assert(css.includes('.central-playback-spinner'), `${relative} is missing the central loading visual`);
  }
  for (const relative of ['public/app.js', 'hostinger/app-v3.js']) {
    const source = fs.readFileSync(path.join(root, relative), 'utf8');
    assert(!source.includes('playerSpinner'), `${relative} still references the removed loading element`);
    assert(source.includes('renderCentralPlaybackState'), `${relative} is missing the authoritative renderer`);
    assert(source.includes('ensureCentralPlaybackController()?.bind?.()'), `${relative} does not bind centralized event state`);
  }
}

console.log(`Player loading and encoding regression tests passed: ${PLAYER_EVENTS.length} media events`);

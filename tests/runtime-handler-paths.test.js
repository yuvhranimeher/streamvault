'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const appSource = read('hostinger/app-v3.js');
const seriesOverlaySource = read('hostinger/series-modal-episodes-v7.js');
const movieOverlaySource = read('hostinger/movie-play-button-v10.js');
const playerOverlaySource = read('hostinger/player.js');
const sessionApi = require(path.join(root, 'hostinger', 'frontend-playback-session.js'));

function extractFunction(source, name) {
  const pattern = new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`);
  const match = pattern.exec(source);
  assert(match, `missing production function ${name}`);
  const start = match.index;
  const paramsOpen = source.indexOf('(', start);
  let paramsDepth = 0;
  let paramsClose = -1;
  for (let index = paramsOpen; index < source.length; index += 1) {
    if (source[index] === '(') paramsDepth += 1;
    if (source[index] === ')') {
      paramsDepth -= 1;
      if (paramsDepth === 0) {
        paramsClose = index;
        break;
      }
    }
  }
  const open = source.indexOf('{', paramsClose);
  assert(open >= 0, `missing body for production function ${name}`);

  let depth = 0;
  let quote = '';
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = open; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (lineComment) {
      if (char === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        quote = '';
      }
      continue;
    }
    if (char === '/' && next === '/') {
      lineComment = true;
      index += 1;
      continue;
    }
    if (char === '/' && next === '*') {
      blockComment = true;
      index += 1;
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }

  throw new Error(`unterminated production function ${name}`);
}

function installFunctions(context, source, names) {
  vm.runInContext(names.map(name => extractFunction(source, name)).join('\n\n'), context);
}

function createClassList(initial = []) {
  const values = new Set(initial);
  return {
    add: (...names) => names.forEach(name => values.add(name)),
    remove: (...names) => names.forEach(name => values.delete(name)),
    contains: name => values.has(name),
    toggle: (name, force) => {
      const enabled = force === undefined ? !values.has(name) : !!force;
      if (enabled) values.add(name);
      else values.delete(name);
      return enabled;
    },
    values,
  };
}

function createElement(initialClasses = []) {
  const attributes = new Map();
  return {
    classList: createClassList(initialClasses),
    style: {},
    scrollTop: 0,
    dataset: {},
    setAttribute: (name, value) => attributes.set(name, String(value)),
    getAttribute: name => attributes.get(name) ?? null,
    attributes,
  };
}

function runAudioRuntimePath() {
  const context = vm.createContext({
    URLSearchParams,
    console,
    window: { SV_AUDIO_DEBUG: false },
    svLiveConsoleLog: () => {},
    svPlaybackSessionApi: sessionApi,
    SV_DEBUG_LOGS: false,
    mediaFixLog: () => {},
    renderAudioTracks: () => {},
    svSyncVolumeUi: () => {},
    svPlayerVideo: () => context.vid,
    svActivePlaybackType: 'media',
    hlsInstance: null,
    currentAudioIdx: 0,
    availableAudio: [],
    vid: {
      audioTracks: { length: 0 },
      muted: false,
      volume: 1,
      _appliedAudioIdx: 0,
    },
    svMediaPlayerState: {
      sessionKey: '',
      preferredAudioLanguage: null,
      preferredAudioReason: '',
      audioSelectionReason: '',
      manualAudioIndex: null,
      serverAudioIndex: null,
      manifestAudioIndex: null,
      audioLocked: false,
    },
  });
  context.svAudioSession = sessionApi.createAudioSessionController();

  installFunctions(context, appSource, [
    'audioTrackText',
    'audioTrackIsAudible',
    'audioTrackStreamIndex',
    'audioDebugSummary',
    'selectedAudioTrack',
    'setAppliedAudioIndex',
    'svAudioDebugAssignment',
    'svSetCurrentAudioIndex',
    'svAssignHlsAudioTrack',
    'svAssignNativeAudioTrack',
    'svResolveActualAudioIndex',
    'svPreferredAudioDecision',
    'svApplyActiveAudioAuthority',
    'recordManualAudioSelection',
    'appendSelectedAudioParams',
  ]);

  const tracks = [
    {
      index: 0,
      relativeIndex: 0,
      streamIndex: 1,
      language: 'hin',
      title: 'Hindi',
      codec: 'aac',
      channels: 2,
      default: true,
    },
    {
      index: 1,
      relativeIndex: 1,
      streamIndex: 2,
      language: 'eng',
      title: 'English',
      codec: 'aac',
      channels: 2,
    },
  ];

  function beginEnglishSeries(title, mediaId) {
    const session = context.svAudioSession.begin({
      mediaType: 'series',
      mediaId,
      season: 1,
      episode: 1,
      sourceIdentity: `${mediaId}-s1e1`,
      title,
      titleMetadata: {
        title,
        name: title,
        category: 'TV-WEB-Series',
        filename: `${title} [Dual Audio]`,
      },
    });
    Object.assign(context.svMediaPlayerState, {
      sessionKey: session.key,
      preferredAudioLanguage: session.preferredLanguage,
      preferredAudioReason: session.preferredLanguageReason,
      audioSelectionReason: '',
      manualAudioIndex: null,
      serverAudioIndex: null,
      manifestAudioIndex: null,
      audioLocked: false,
    });
    context.availableAudio = tracks.map(track => ({ ...track }));
    context.currentAudioIdx = 0;
    context.vid._appliedAudioIdx = 0;
    const hls = {
      audioTrack: 0,
      audioTracks: [
        { lang: 'hi', name: 'Hindi' },
        { lang: 'en', name: 'English' },
      ],
    };
    context.hlsInstance = hls;
    return hls;
  }

  for (const [title, mediaId] of [
    ['Game of Thrones', 'got'],
    ['Breaking Bad', 'breaking-bad'],
  ]) {
    const debugAssignments = [];
    context.window.SV_AUDIO_DEBUG = title === 'Game of Thrones';
    context.svLiveConsoleLog = (_label, payload) => debugAssignments.push(payload);
    const hls = beginEnglishSeries(title, mediaId);
    assert.equal(
      context.svApplyActiveAudioAuthority(hls, context.vid, `${title} manifest`, {
        reason: 'HLS tracks discovered',
      }),
      true
    );
    assert.equal(context.currentAudioIdx, 1, `${title} selects logical English track`);
    assert.equal(context.availableAudio[context.currentAudioIdx].streamIndex, 2, `${title} selects English stream 2`);
    assert.equal(hls.audioTrack, 1, `${title} selects the English HLS track`);

    hls.audioTrack = 0;
    context.svApplyActiveAudioAuthority(hls, context.vid, `${title} canplay`, {
      reason: 'reapply after later default-track overwrite',
    });
    assert.equal(hls.audioTrack, 1, `${title} reapplies English after a later default-track overwrite`);

    const params = new URLSearchParams();
    context.appendSelectedAudioParams(params, `${title} playback plan`);
    assert.equal(params.get('audio'), '1', `${title} sends the selected relative audio index`);
    assert.equal(params.get('audioStream'), '2', `${title} sends absolute English stream 2`);
    if (title === 'Game of Thrones') {
      assert(
        debugAssignments.some(entry =>
          entry.caller
          && entry.mediaSessionKey
          && entry.preferredLanguage === 'en'
          && entry.targetTrack
          && Object.prototype.hasOwnProperty.call(entry, 'previousTrack')
          && entry.reason
        ),
        'window.SV_AUDIO_DEBUG logs caller, session, language, target, previous, and reason'
      );
    }
  }
  context.window.SV_AUDIO_DEBUG = false;

  const manualHls = beginEnglishSeries('Game of Thrones', 'got-manual');
  context.recordManualAudioSelection(0, 'runtime harness manual Hindi');
  context.svApplyActiveAudioAuthority(manualHls, context.vid, 'setAudio', {
    reason: 'manual session selection',
  });
  assert.equal(manualHls.audioTrack, 0, 'manual selection becomes authoritative in the active session');

  const nextHls = beginEnglishSeries('Breaking Bad', 'breaking-bad-next');
  context.svApplyActiveAudioAuthority(nextHls, context.vid, 'next playback session', {
    reason: 'new session preferred language',
  });
  assert.equal(nextHls.audioTrack, 1, 'manual selection does not leak into the next playback session');
}

async function runModalRuntimePath() {
  const elements = {
    mediaModal: createElement(['show']),
    movieDetailModal: createElement(['open']),
    seriesModal: createElement(['open']),
  };
  elements.mediaModal.setAttribute('aria-hidden', 'false');
  const modalContent = createElement();
  const body = createElement();
  const restored = [];
  const played = [];
  let historyPushes = 0;

  const context = vm.createContext({
    console,
    structuredClone,
    requestAnimationFrame: callback => callback(),
    setTimeout: callback => {
      callback();
      return 1;
    },
    window: {},
    document: {
      body,
      documentElement: {
        getAttribute: () => 'dark',
      },
      getElementById: id => elements[id] || null,
      querySelector: selector => selector === '#mediaModal .media-modal-content' ? modalContent : null,
    },
    history: {
      state: { view: 'detail' },
      pushState: () => {
        historyPushes += 1;
      },
      replaceState: () => {},
    },
    location: { href: 'https://streamvault.example/' },
    currentMediaModalItem: null,
    currentMediaModalType: 'movie',
    currentShow: null,
    currentDetailMovie: null,
    currentSeason: 1,
    svMediaModalSelectedEpisode: null,
    svPlayerLaunchSnapshot: null,
    svPlayerLaunchItem: null,
    svPlayerReturnState: null,
    svPlayerReturnItem: null,
    svDetailHistoryLock: false,
    series: [],
    movies: [],
    esc: value => String(value),
    svPauseMediaModalPreview: () => {},
    svPushPlayerHistory: () => {
      historyPushes += 1;
    },
    svCurrentDetailState: (_type, extra = {}) => ({
      view: 'detail',
      type: 'media',
      source: 'media-modal',
      mediaType: context.currentMediaModalType,
      mediaId: context.currentMediaModalItem?.id || '',
      mediaKey: `${context.currentMediaModalType}:${context.currentMediaModalItem?.id || ''}`,
      key: `${context.currentMediaModalType}:${context.currentMediaModalItem?.id || ''}`,
      selectedSeason: extra.season ?? context.currentSeason,
      selectedEpisode: extra.epIdx ?? context.svMediaModalSelectedEpisode,
      modalScrollTop: 43,
      browsingView: { tab: 'series', scrollY: 250 },
      browsingScrollTop: 250,
      theme: 'dark',
      historyVersion: 2,
    }),
    svStableMediaKey: (item, type) => `${type}:${item?.id || ''}`,
    svPlaybackMediaId: item => item?.id || '',
    svRestoreBrowseState: () => restored.push('browse'),
    populateModal: item => restored.push(`modern:${item.id}`),
    updateMediaModalWishlistButton: () => {},
    updateMovieWatchlistButtons: () => {},
    updateSeriesWatchlistButton: () => {},
    applyTheme: () => {},
    displayText: value => value,
    svPlaybackContextForEpisode: (show, season, index, episode) => ({
      mediaType: 'series',
      mediaId: show.id,
      season,
      episode: episode.episode ?? index,
    }),
    svPlaybackContextForMovie: movie => ({
      mediaType: 'movie',
      mediaId: movie.id,
    }),
    playFtpMedia: (url, title, year, playbackContext) => {
      played.push({ url, title, year, playbackContext });
    },
    playMedia: (id, title, year, playbackContext) => {
      played.push({ id, title, year, playbackContext });
    },
    showSeriesPlayerBar: () => {},
    hydrateMoviePlayback: async movie => movie,
    isMovieUnavailable: () => false,
    showToast: message => {
      throw new Error(`unexpected toast: ${message}`);
    },
    recordWatchHistory: () => {},
    movieIdentity: movie => movie.id,
  });

  installFunctions(context, appSource, [
    'svDeepFreezeSnapshot',
    'svImmutableLaunchSnapshot',
    'svCaptureModernModalLaunch',
    'svSuspendMediaModalForPlayback',
    'svLaunchMediaModalEpisode',
    'svLaunchMediaModalMovie',
    'playMediaModalPrimary',
    'playMediaModalEpisode',
    'playSeriesEpisode',
    'playMovieFromDetail',
    'svRememberPlaybackReturnState',
    'svResolveMediaModalItem',
    'svRestoreModernMediaModal',
  ]);

  const show = {
    id: 'got',
    name: 'Game of Thrones',
    seasons: {
      1: [{ episode: 1, streamUrl: '/got-s1e1.mkv', epTitle: 'Winter Is Coming' }],
    },
  };
  context.currentShow = show;
  context.currentMediaModalItem = show;
  context.currentMediaModalType = 'tv';
  context.series = [show];

  context.playMediaModalEpisode(1, 0);
  assert.equal(played.at(-1).url, '/got-s1e1.mkv', 'episode card invokes the actual episode playback handler');
  assert.equal(context.svPlayerReturnState.source, 'media-modal', 'episode launch stores a modern modal snapshot');
  assert.equal(context.svPlayerReturnState.selectedEpisode, 0, 'episode launch stores the selected episode');
  assert(Object.isFrozen(context.svPlayerReturnState), 'episode launch snapshot is immutable');
  const episodeSnapshot = context.svPlayerReturnState;
  context.svRememberPlaybackReturnState('series', { season: 9, epIdx: 9 });
  assert.equal(context.svPlayerReturnState, episodeSnapshot, 'legacy series snapshot cannot overwrite the launch snapshot');
  assert.equal(context.svPlayerReturnState.selectedSeason, 1, 'immutable launch season is preserved');
  assert.equal(elements.mediaModal.classList.contains('hidden'), true, 'player launch suspends the modern popup without rendering legacy details');

  context.svRestoreModernMediaModal(episodeSnapshot);
  assert.equal(elements.mediaModal.classList.contains('show'), true, 'episode Back restores the modern popup');
  assert.equal(elements.seriesModal.classList.contains('open'), false, 'episode Back suppresses the legacy series renderer');
  assert.equal(elements.movieDetailModal.classList.contains('open'), false, 'episode Back suppresses the legacy movie renderer');
  assert.equal(restored.at(-1), 'modern:got', 'episode Back calls the modern popup renderer directly');

  const movie = {
    id: 'internship',
    name: 'The Internship',
    year: '2013',
    streamUrl: '/The.Internship.[Dual Audio].mkv',
  };
  elements.mediaModal.classList.remove('hidden');
  elements.mediaModal.classList.add('show');
  context.currentMediaModalItem = movie;
  context.currentMediaModalType = 'movie';
  context.currentDetailMovie = movie;
  context.svPlayerLaunchSnapshot = null;
  context.svPlayerLaunchItem = null;
  context.svPlayerReturnState = null;
  context.svPlayerReturnItem = null;
  context.movies = [movie];

  await context.playMediaModalPrimary();
  assert.equal(played.at(-1).url, movie.streamUrl, 'movie Play invokes the actual movie detail playback handler');
  assert.equal(played.at(-1).playbackContext.mediaId, movie.id, 'movie Play preserves the full movie playback context');
  assert.equal(context.svPlayerReturnState.source, 'media-modal', 'movie launch stores a modern modal snapshot');
  const movieSnapshot = context.svPlayerReturnState;
  context.svRestoreModernMediaModal(movieSnapshot);
  assert.equal(restored.at(-1), 'modern:internship', 'movie Back calls the modern popup renderer directly');
  assert.equal(elements.seriesModal.classList.contains('open'), false, 'movie Back never opens the legacy series renderer');
  assert(historyPushes >= 2, 'actual episode and movie handlers push player history');
}

async function runLaterOverlayPaths() {
  {
    let launched = null;
    const context = vm.createContext({
      storeShow: () => {},
      currentSeason: 1,
      svLaunchMediaModalEpisode: (show, season, index) => {
        launched = { show, season, index };
      },
      closeMediaModal: () => {
        throw new Error('series overlay must not close the modern modal before launch');
      },
      playSeriesEpisode: () => {
        throw new Error('series overlay must not bypass the modern launch handler');
      },
    });
    installFunctions(context, seriesOverlaySource, ['play']);
    const show = { name: 'Game of Thrones' };
    context.play(show, 1, 0);
    assert.deepEqual(launched, { show, season: 1, index: 0 }, 'live series overlay delegates to the modern episode launcher');
  }

  {
    let launched = null;
    const context = vm.createContext({
      console,
      currentDetailMovie: null,
      hydrateMoviePlayback: async movie => movie,
      isMovieUnavailable: () => false,
      recordWatchHistory: () => {},
      movieIdentity: movie => movie.id,
      svLaunchMediaModalMovie: movie => {
        launched = movie;
      },
      playMovieFromDetail: () => {
        throw new Error('movie overlay should use the modern launcher when available');
      },
      playFtpMedia: () => {
        throw new Error('movie overlay must not bypass movie detail playback context');
      },
      playMedia: () => {
        throw new Error('movie overlay must not bypass movie detail playback context');
      },
      showToast: message => {
        throw new Error(`unexpected toast: ${message}`);
      },
      window: { StreamVaultConfig: {} },
    });
    installFunctions(context, movieOverlaySource, ['startMovie']);
    const movie = { id: 'breaking-bad-movie', name: 'Breaking Bad', streamUrl: '/breaking-bad.mkv' };
    const button = { disabled: false, innerHTML: '' };
    await context.startMovie(movie, button);
    assert.equal(launched, movie, 'live movie overlay delegates to the modern movie launcher');
  }

  {
    let receivedOptions = null;
    const context = vm.createContext({
      closePlayer: options => {
        receivedOptions = options;
        return 'closed';
      },
      vid: {
        removeAttribute: () => {},
        load: () => {},
      },
      currentTab: 'movies',
      window: {
        requestIdleCallback: callback => callback(),
        matchMedia: () => ({ matches: false }),
      },
      document: {
        getElementById: () => null,
      },
      setTimeout: callback => {
        callback();
        return 1;
      },
      startHeroTimer: () => {},
      svUpdateCarouselControls: () => {},
    });
    vm.runInContext(playerOverlaySource, context);
    const options = { fromHistory: true, restore: true, returnState: { source: 'media-modal' } };
    assert.equal(context.closePlayer(options), 'closed', 'later player wrapper returns the original close result');
    assert.equal(receivedOptions, options, 'later player wrapper preserves popstate close options');
  }
}

async function main() {
  runAudioRuntimePath();
  await runModalRuntimePath();
  await runLaterOverlayPaths();

  assert.match(appSource, /window\.SV_AUDIO_DEBUG !== true/, 'audio assignment logs stay behind window.SV_AUDIO_DEBUG = true');
  assert.match(appSource, /Hls\.Events\.AUDIO_TRACKS_UPDATED/, 'HLS track discovery reapplies active audio authority');
  assert.match(appSource, /video\.addEventListener\('playing', reset/, 'native playing reapplies active audio authority');
  assert.doesNotMatch(seriesOverlaySource, /closeMediaModal\(\)[\s\S]{0,120}playSeriesEpisode/, 'series overlay no longer closes into legacy playback');
  assert.doesNotMatch(movieOverlaySource, /closeMediaModal\(\)[\s\S]{0,180}playFtpMedia/, 'movie overlay no longer bypasses modern movie playback');

  process.stdout.write('runtime handler path regression tests passed\n');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

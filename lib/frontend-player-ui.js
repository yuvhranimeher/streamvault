(function attachStreamVaultPlayerUi(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.StreamVaultPlayerUi = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createStreamVaultPlayerUi() {
  'use strict';

  const PLAYER_EVENTS = [
    'loadstart',
    'loadedmetadata',
    'loadeddata',
    'canplay',
    'canplaythrough',
    'play',
    'playing',
    'pause',
    'waiting',
    'stalled',
    'seeking',
    'seeked',
    'ended',
    'emptied',
    'error',
    'abort'
  ];

  const DISPLAY_REPAIRS = Object.freeze([
    ['ÃƒÆ’Ã¢â‚¬â€', '×'],
    ['Ã¢â‚¬â€œ', '–'],
    ['Ã¢â‚¬â€', '—'],
    ['Ã¢â‚¬Â¦', '…'],
    ['Ã¢â‚¬â„¢', '’'],
    ['Ã¢â‚¬Å“', '“'],
    ['Ã¢â‚¬Â', '”'],
    ['Ãƒâ€”', '×'],
    ['Ã‚Â·', '·'],
    ['â€“', '–'],
    ['â€”', '—'],
    ['â€¦', '…'],
    ['â€™', '’'],
    ['â€œ', '“'],
    ['â€', '”'],
    ['Ã—', '×'],
    ['Â·', '·']
  ]);

  function repairDisplayText(value, options) {
    let text = String(value == null ? '' : value);
    const kind = String(options?.kind || 'display').toLowerCase();
    if (kind === 'url' || kind === 'path' || kind === 'identifier' || kind === 'token') return text;
    if (/^(?:https?:|blob:|data:|file:)/i.test(text) || /^[A-Za-z]:[\\/]/.test(text) || /^(?:\.\.?(?:[\\/])|[\\/])/.test(text)) return text;
    for (let pass = 0; pass < 3; pass += 1) {
      let repaired = text;
      for (const [broken, correct] of DISPLAY_REPAIRS) repaired = repaired.split(broken).join(correct);
      if (repaired === text) break;
      text = repaired;
    }
    return text;
  }

  function repairVisibleAttributes(element) {
    for (const name of ['placeholder', 'title', 'aria-label']) {
      if (!element.hasAttribute?.(name)) continue;
      const value = element.getAttribute(name);
      const repaired = repairDisplayText(value);
      if (repaired !== value) element.setAttribute(name, repaired);
    }
  }

  function repairVisibleNode(node) {
    if (!node) return;
    if (node.nodeType === 3) {
      if (/^(?:SCRIPT|STYLE|NOSCRIPT|TEMPLATE)$/i.test(node.parentElement?.tagName || '')) return;
      const repaired = repairDisplayText(node.nodeValue);
      if (repaired !== node.nodeValue) node.nodeValue = repaired;
      return;
    }
    if (node.nodeType !== 1 && node.nodeType !== 9 && node.nodeType !== 11) return;
    if (node.nodeType === 1) repairVisibleAttributes(node);
    const documentRef = node.ownerDocument || node;
    const showText = documentRef.defaultView?.NodeFilter?.SHOW_TEXT || 4;
    const walker = documentRef.createTreeWalker?.(node, showText);
    if (walker) {
      let textNode = walker.nextNode();
      while (textNode) {
        repairVisibleNode(textNode);
        textNode = walker.nextNode();
      }
    }
    for (const element of node.querySelectorAll?.('[placeholder],[title],[aria-label]') || []) repairVisibleAttributes(element);
  }

  function installDisplayTextRepair(documentRef) {
    if (!documentRef || documentRef.__svDisplayTextRepairInstalled) return false;
    documentRef.__svDisplayTextRepairInstalled = true;
    repairVisibleNode(documentRef);
    const Observer = documentRef.defaultView?.MutationObserver || (typeof MutationObserver !== 'undefined' ? MutationObserver : null);
    if (!Observer) return true;
    const observer = new Observer(records => {
      for (const record of records) {
        if (record.type === 'characterData') repairVisibleNode(record.target);
        for (const node of record.addedNodes || []) repairVisibleNode(node);
      }
    });
    observer.observe(documentRef.documentElement, { childList: true, subtree: true, characterData: true });
    documentRef.__svDisplayTextRepairObserver = observer;
    return true;
  }

  function deriveCentralPlaybackState(flags, video) {
    if (flags.error) return 'error';
    if (flags.loading || flags.buffering || flags.seeking) return 'loading';
    if (!video || video.paused || video.ended || flags.ended) return 'paused';
    return 'playing';
  }

  const ICON_PATHS = Object.freeze({
    play: 'M8 5v14l11-7z',
    pause: 'M6 19h4V5H6v14zm8-14v14h4V5h-4z'
  });

  function svgIcon(id, path) {
    return `<svg${id ? ` id="${id}"` : ''} class="central-playback-icon" viewBox="0 0 24 24" width="34" height="34" fill="currentColor" aria-hidden="true"><path d="${path}"/></svg>`;
  }

  function createCentralPlaybackController(options) {
    const video = options.video;
    const button = options.button;
    const transportIcon = options.transportIcon || null;
    const showUi = typeof options.showUi === 'function' ? options.showUi : function noop() {};
    const flags = { loading: false, buffering: false, seeking: false, error: false, ended: false };
    const listeners = new Map();
    let bound = false;
    let renderedState = '';

    function render() {
      const state = deriveCentralPlaybackState(flags, video);
      if (button && state !== renderedState) {
        if (state === 'loading') {
          button.innerHTML = '<span class="central-playback-spinner" role="status" aria-label="Loading playback"></span>';
        } else {
          button.innerHTML = svgIcon('ppCenterIcon', state === 'playing' ? ICON_PATHS.pause : ICON_PATHS.play);
        }
      }
      renderedState = state;

      if (button) {
        const label = state === 'loading'
          ? 'Loading playback'
          : state === 'playing'
            ? 'Pause'
            : state === 'error'
              ? 'Playback unavailable'
              : (video && video.ended ? 'Replay' : 'Play');
        button.dataset.playbackState = state;
        button.setAttribute('aria-label', label);
        button.setAttribute('title', label);
        button.setAttribute('aria-live', 'polite');
        button.setAttribute('aria-busy', state === 'loading' ? 'true' : 'false');
        button.setAttribute('aria-disabled', state === 'loading' ? 'true' : 'false');
      }

      if (transportIcon) {
        const paused = !video || video.paused || video.ended || flags.ended || state === 'error';
        transportIcon.innerHTML = `<path d="${paused ? ICON_PATHS.play : ICON_PATHS.pause}"/>`;
      }
      return state;
    }

    function clearBusyFlags() {
      flags.loading = false;
      flags.buffering = false;
      flags.seeking = false;
    }

    function handle(type) {
      switch (type) {
        case 'loadstart':
          flags.error = false;
          flags.ended = false;
          flags.loading = true;
          flags.buffering = false;
          flags.seeking = false;
          break;
        case 'loadeddata':
          flags.loading = false;
          break;
        case 'loadedmetadata':
          break;
        case 'canplay':
        case 'canplaythrough':
          flags.loading = false;
          if (!video || video.paused) flags.buffering = false;
          break;
        case 'play':
          flags.error = false;
          flags.ended = false;
          flags.loading = true;
          break;
        case 'playing':
          flags.error = false;
          flags.ended = false;
          clearBusyFlags();
          break;
        case 'pause':
          if (!video || Number(video.readyState || 0) >= 2 || !video.currentSrc) flags.loading = false;
          flags.buffering = false;
          flags.seeking = false;
          break;
        case 'waiting':
        case 'stalled':
          if (!flags.error && !flags.ended) flags.buffering = true;
          showUi();
          break;
        case 'seeking':
          if (!flags.error && !flags.ended) flags.seeking = true;
          showUi();
          break;
        case 'seeked':
          flags.seeking = false;
          if (!video || video.paused || Number(video.readyState || 0) >= 3) flags.buffering = false;
          break;
        case 'ended':
          clearBusyFlags();
          flags.ended = true;
          break;
        case 'emptied':
          clearBusyFlags();
          flags.error = false;
          flags.ended = false;
          break;
        case 'error':
          clearBusyFlags();
          flags.error = true;
          break;
        case 'abort':
          if (video && video.error) {
            clearBusyFlags();
            flags.error = true;
          }
          break;
        default:
          break;
      }
      return render();
    }

    function bind() {
      if (bound || !video || typeof video.addEventListener !== 'function') return;
      for (const type of PLAYER_EVENTS) {
        const listener = function playerStateListener() { handle(type); };
        listeners.set(type, listener);
        video.addEventListener(type, listener);
      }
      bound = true;
      render();
    }

    function unbind() {
      if (!bound || !video || typeof video.removeEventListener !== 'function') return;
      for (const [type, listener] of listeners) video.removeEventListener(type, listener);
      listeners.clear();
      bound = false;
    }

    function beginLoading() {
      flags.error = false;
      flags.ended = false;
      flags.loading = true;
      flags.buffering = false;
      flags.seeking = false;
      return render();
    }

    function clearLoading() {
      flags.loading = false;
      return render();
    }

    function fail() {
      clearBusyFlags();
      flags.error = true;
      return render();
    }

    function reset() {
      clearBusyFlags();
      flags.error = false;
      flags.ended = false;
      return render();
    }

    return {
      bind,
      unbind,
      beginLoading,
      clearLoading,
      fail,
      reset,
      render,
      handle,
      getState: function getState() { return deriveCentralPlaybackState(flags, video); },
      isLoading: function isLoading() { return deriveCentralPlaybackState(flags, video) === 'loading'; },
      listenerCount: function listenerCount() { return listeners.size; },
      flags
    };
  }

  return {
    DISPLAY_REPAIRS,
    PLAYER_EVENTS,
    createCentralPlaybackController,
    deriveCentralPlaybackState,
    installDisplayTextRepair,
    repairDisplayText
  };
});

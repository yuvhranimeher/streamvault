(function configureStreamVault(global) {
  'use strict';

  const BUILD_VERSION = '20260714-hostinger-playback-recovery-v1';
  const BACKEND_ORIGIN = 'https://backend.streamvault.fit';
  const BACKEND_PATHS = [
    '/api',
    '/download',
    '/live',
    '/live-relay',
    '/proxy',
    '/stream',
    '/subtitles',
    '/subtitle',
    '/audio',
    '/hls',
    '/playback'
  ];
  const LEGACY_FRONTEND_ORIGINS = new Set([
    'https://streamvault.fit',
    'https://www.streamvault.fit'
  ]);
  const MESSAGES = Object.freeze({
    backend: 'StreamVault backend is temporarily offline.',
    playback: 'Playback server is currently offline.',
    liveTv: 'Live TV server is currently offline.',
    action: 'This backend feature is currently offline.'
  });

  function isBackendPath(pathname) {
    return BACKEND_PATHS.some(prefix => pathname === prefix || pathname.startsWith(prefix + '/'));
  }

  function backendUrl(input) {
    if (input == null) return input;
    let url;
    try {
      url = new URL(String(input), global.location.href);
    } catch (_error) {
      return input;
    }

    const shouldRoute = isBackendPath(url.pathname)
      && (url.origin === global.location.origin || LEGACY_FRONTEND_ORIGINS.has(url.origin));
    if (!shouldRoute) return input instanceof URL ? url.toString() : input;
    return BACKEND_ORIGIN + url.pathname + url.search + url.hash;
  }

  function normalizeBackendUrls(value) {
    if (value instanceof URL) return value.toString();
    if (typeof value === 'string') {
      if (/^[a-z][a-z\d+.-]*:/i.test(value) || value.startsWith('//')) return value;
      return backendUrl(value);
    }
    if (Array.isArray(value)) return value.map(normalizeBackendUrls);
    if (!value || typeof value !== 'object') return value;

    const normalized = {};
    for (const [key, child] of Object.entries(value)) {
      normalized[key] = normalizeBackendUrls(child);
    }
    return normalized;
  }

  const backendStatus = {
    checked: false,
    available: null,
    checkedAt: 0,
    version: null
  };
  let statusObservation = 0;
  let publishedObservation = 0;

  function publishBackendStatus(available, version, observation = ++statusObservation) {
    if (observation < publishedObservation) return backendStatus;
    publishedObservation = observation;
    const changed = backendStatus.available !== available
      || (version !== undefined && backendStatus.version !== (version || null));
    backendStatus.checked = true;
    backendStatus.available = available;
    backendStatus.checkedAt = Date.now();
    if (!available) backendStatus.version = null;
    else if (version !== undefined) backendStatus.version = version || null;
    document.documentElement.dataset.backend = available ? 'online' : 'offline';
    if (changed) {
      global.dispatchEvent(new CustomEvent('streamvault:backend-status', {
        detail: { ...backendStatus }
      }));
    }
    return backendStatus;
  }

  const nativeFetch = global.fetch.bind(global);

  global.fetch = function streamVaultFetch(input, init) {
    let backendRequest = false;
    try {
      if (typeof input === 'string' || input instanceof URL) {
        const routed = backendUrl(input);
        input = routed;
        const requestUrl = new URL(String(routed), global.location.href);
        backendRequest = requestUrl.origin === BACKEND_ORIGIN && isBackendPath(requestUrl.pathname);
      } else if (input && input.url) {
        const routed = backendUrl(input.url);
        const requestUrl = new URL(String(routed), global.location.href);
        backendRequest = requestUrl.origin === BACKEND_ORIGIN && isBackendPath(requestUrl.pathname);
        if (routed !== input.url) input = new Request(routed, input);
      }
    } catch (_error) {
      // Preserve the native request if a nonstandard Request object cannot be cloned.
    }
    const request = nativeFetch(input, init);
    if (!backendRequest) return request;
    return request.then(
      response => {
        publishBackendStatus(true);
        return response;
      },
      error => {
        if (error?.name !== 'AbortError') void checkBackendAvailability(1600);
        throw error;
      }
    );
  };

  if (global.XMLHttpRequest) {
    const nativeOpen = global.XMLHttpRequest.prototype.open;
    global.XMLHttpRequest.prototype.open = function streamVaultOpen(method, url, ...rest) {
      const routed = backendUrl(url);
      try {
        const requestUrl = new URL(String(routed), global.location.href);
        if (requestUrl.origin === BACKEND_ORIGIN && isBackendPath(requestUrl.pathname)) {
          this.addEventListener?.('load', () => publishBackendStatus(true), { once: true });
          this.addEventListener?.('error', () => { void checkBackendAvailability(1600); }, { once: true });
          this.addEventListener?.('timeout', () => { void checkBackendAvailability(1600); }, { once: true });
        }
      } catch (_error) {
        // The native XHR implementation will report malformed request URLs.
      }
      return nativeOpen.call(this, method, routed, ...rest);
    };
  }

  function fetchWithTimeout(url, options = {}, timeoutMs = 3500) {
    const controller = new AbortController();
    const parentSignal = options.signal;
    const abortFromParent = () => controller.abort(parentSignal?.reason);
    if (parentSignal?.aborted) abortFromParent();
    else parentSignal?.addEventListener?.('abort', abortFromParent, { once: true });
    const timer = global.setTimeout(() => controller.abort(), timeoutMs);
    return nativeFetch(backendUrl(url), { ...options, signal: controller.signal })
      .finally(() => {
        global.clearTimeout(timer);
        parentSignal?.removeEventListener?.('abort', abortFromParent);
      });
  }

  function loadStaticJson(path) {
    return fetchWithTimeout(path, {
      cache: 'no-cache',
      headers: { Accept: 'application/json' }
    }, 5000).then(response => {
      if (!response.ok) throw new Error(`${path} HTTP ${response.status}`);
      return response.json().then(normalizeBackendUrls);
    });
  }

  const staticData = Object.freeze({
    homeFeed: loadStaticJson('/home-feed.json'),
    channels: loadStaticJson('/channels.json')
  });

  function checkBackendAvailability(timeoutMs = 2500) {
    const observation = ++statusObservation;
    return fetchWithTimeout(BACKEND_ORIGIN + '/api/version', {
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    }, timeoutMs)
      .then(response => response.json().catch(() => ({})))
      .then(payload => publishBackendStatus(true, payload.version || payload.commit || null, observation))
      .catch(() => publishBackendStatus(false, null, observation));
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator) || !/^https?:$/.test(global.location.protocol)) {
      return Promise.resolve(null);
    }
    return navigator.serviceWorker.register('/sw-20260714-v4.js', {
      scope: '/',
      updateViaCache: 'none'
    });
  }

  async function showOfflineMessage(kind = 'action') {
    const status = await checkBackendAvailability(1600);
    if (status.available) return null;
    const message = MESSAGES[kind] || MESSAGES.action;
    if (typeof global.showToast === 'function') global.showToast(message);
    else console.warn(`[StreamVault] ${message}`);
    return message;
  }

  const config = Object.freeze({
    apiOrigin: BACKEND_ORIGIN,
    backendOrigin: BACKEND_ORIGIN,
    backendUrl,
    apiUrl: backendUrl,
    backendStatus,
    buildVersion: BUILD_VERSION,
    checkBackendAvailability,
    fetchWithTimeout,
    isBackendPath,
    messages: MESSAGES,
    normalizeBackendUrls,
    offlineMessage: MESSAGES.backend,
    registerServiceWorker,
    showOfflineMessage,
    staticData
  });

  global.API_BASE = BACKEND_ORIGIN;
  global.STREAMVAULT_BACKEND_OFFLINE_MESSAGE = MESSAGES.backend;
  global.__svBackendStatus = backendStatus;
  global.STREAMVAULT_CONFIG = config;
  global.StreamVaultConfig = config;
  global.__svBackendCheckPromise = checkBackendAvailability();
  global.addEventListener('load', () => {
    registerServiceWorker().catch(error => {
      console.warn('[StreamVault] service worker registration failed:', error.message);
    });
  }, { once: true });
})(window);

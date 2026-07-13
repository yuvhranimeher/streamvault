(function configureStreamVault(global) {
  'use strict';

  const BUILD_VERSION = '20260713-hostinger-frontend-v3';
  const BACKEND_ORIGIN = 'https://backend.streamvault.fit';
  const BACKEND_PATHS = [
    '/api',
    '/download',
    '/live',
    '/live-relay',
    '/proxy',
    '/stream',
    '/subtitles'
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

  const backendStatus = {
    checked: false,
    available: null,
    checkedAt: 0,
    version: null
  };

  function publishBackendStatus(available, version) {
    backendStatus.checked = true;
    backendStatus.available = available;
    backendStatus.checkedAt = Date.now();
    backendStatus.version = version || null;
    document.documentElement.dataset.backend = available ? 'online' : 'offline';
    global.dispatchEvent(new CustomEvent('streamvault:backend-status', {
      detail: { ...backendStatus }
    }));
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
    return request.catch(error => {
      if (error?.name !== 'AbortError') publishBackendStatus(false, null);
      throw error;
    });
  };

  if (global.XMLHttpRequest) {
    const nativeOpen = global.XMLHttpRequest.prototype.open;
    global.XMLHttpRequest.prototype.open = function streamVaultOpen(method, url, ...rest) {
      return nativeOpen.call(this, method, backendUrl(url), ...rest);
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
      return response.json();
    });
  }

  const staticData = Object.freeze({
    homeFeed: loadStaticJson('/home-feed.json'),
    channels: loadStaticJson('/channels.json')
  });

  function checkBackendAvailability(timeoutMs = 2500) {
    return fetchWithTimeout(BACKEND_ORIGIN + '/api/version', {
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    }, timeoutMs)
      .then(response => {
        if (!response.ok) throw new Error(`backend HTTP ${response.status}`);
        return response.json().catch(() => ({}));
      })
      .then(payload => publishBackendStatus(true, payload.version || payload.commit || null))
      .catch(() => publishBackendStatus(false, null));
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

  function showOfflineMessage(kind = 'action') {
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
